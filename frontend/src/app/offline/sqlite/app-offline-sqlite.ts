import {
  OFFLINE_QUEUE_STATE_SQLITE_REQUEST_HANDLERS,
  HYDRATION_ENTITY_STATE_SQLITE_REQUEST_HANDLERS,
  createHydrationEntityClient,
  createManagedSqliteRuntime,
  createOfflineQueueClient,
  createSqliteRequestHandlers,
  createSqliteEntityBundle,
  createSqliteEntityClient,
  createSqliteTransport,
  createSqliteWorkerRuntimeConfig,
  enqueueOfflineCommand,
  runSqliteTransaction,
  type SqliteMigration,
} from "@vireocodedev/sqlite";
import { executeParameterizedSqlitePagedQuery, executeParameterizedSqliteQuery } from "@vireocodedev/query";
import {
  offlineItemIdFor,
  rebaseOfflineItemCommands,
  type AuthoritativeItemState,
  type CachedOfflineItemState,
  type OfflineItemCommand,
} from "../services/app-offline-rebase";

export const APP_OFFLINE_DATABASE_FILE = "starter-template-items.sqlite3";

export type CachedItem = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
  conflict: boolean;
  deleted: boolean;
  pending: boolean;
};

export const appItemBundle = createSqliteEntityBundle({
  entityNameSingular: "Item",
  entityNamePlural: "Items",
  tableName: "items_cache",
  softDelete: { enabled: false },
  fields: {
    id: { column: "id", id: true, fromDb: value => String(value) },
    name: { column: "name", fromDb: value => String(value) },
    description: { column: "description", fromDb: value => String(value ?? "") },
    quantity: { column: "quantity", fromDb: value => Number(value) },
    status: { column: "status", fromDb: value => value as CachedItem["status"] },
    version: { column: "version", fromDb: value => Number(value) },
    pending: { column: "pending", fromDb: value => Number(value) === 1, toDb: value => (value ? 1 : 0) },
    conflict: { column: "conflict", fromDb: value => Number(value) === 1, toDb: value => (value ? 1 : 0) },
    deleted: { column: "deleted", fromDb: value => Number(value) === 1, toDb: value => (value ? 1 : 0) },
  },
  keywordFields: ["name", "description", "status"],
  requestKeys: { replace: "items", upsert: "item", delete: "itemIds" },
});

export const APP_OFFLINE_MIGRATIONS: SqliteMigration[] = [
  db => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS items_cache (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        status TEXT NOT NULL,
        version INTEGER NOT NULL,
        pending INTEGER NOT NULL DEFAULT 0,
        conflict INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS offline_sync_commands (
        command_id TEXT PRIMARY KEY NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        body_json TEXT NOT NULL,
        headers_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT NULL
      );
      CREATE TABLE IF NOT EXISTS hydration_entity_state (
        entity_key TEXT PRIMARY KEY NOT NULL,
        applied_revision INTEGER NOT NULL DEFAULT 0,
        is_stale INTEGER NOT NULL DEFAULT 0,
        last_hydrated_at INTEGER NULL,
        last_row_count INTEGER NULL,
        last_error TEXT NULL
      );
    `);
  },
  db => {
    db.exec("ALTER TABLE items_cache ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;");
  },
  db => {
    db.exec("ALTER TABLE items_cache ADD COLUMN keywords TEXT NOT NULL DEFAULT '';");
  },
  db => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS offline_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
  },
];

export const appOfflineRuntime = createManagedSqliteRuntime({
  workerFactory: () => new Worker(new URL("./app-offline.worker.ts", import.meta.url), { type: "module" }),
  shouldUseInMemoryFallback: () => typeof Worker === "undefined",
});

export const appOfflineTransport = createSqliteTransport({ runtime: appOfflineRuntime });

export const appOfflineItems = createSqliteEntityClient<CachedItem, string>({
  runtime: appOfflineRuntime,
  transport: appOfflineTransport,
  getKey: item => item.id,
  compare: (left, right) => left.name.localeCompare(right.name),
  requests: {
    replace: { type: appItemBundle.operationNames.replace, payloadKey: appItemBundle.requestKeys.replace },
    upsert: { type: appItemBundle.operationNames.upsert, payloadKey: appItemBundle.requestKeys.upsert },
    list: { type: appItemBundle.operationNames.list },
    delete: { type: appItemBundle.operationNames.delete, payloadKey: appItemBundle.requestKeys.delete },
  },
});

export const appOfflineQueue = createOfflineQueueClient({ runtime: appOfflineRuntime, transport: appOfflineTransport });
export const appOfflineHydration = createHydrationEntityClient({
  runtime: appOfflineRuntime,
  transport: appOfflineTransport,
});

/** Applies the local view and durable replay command in one SQLite transaction. */
const appItemMutationHandlers = createSqliteRequestHandlers({
  applyItemMutation: (db, request) => {
    const mutation = request as unknown as {
      command: {
        body: unknown | null;
        commandId: string;
        createdAt: number;
        headers: Record<string, string>;
        method: string;
        url: string;
      };
      item?: CachedItem;
      itemId?: string;
    };
    runSqliteTransaction(db, () => {
      const count = db.prepare("SELECT COUNT(1) FROM offline_sync_commands;");
      try {
        if (count.step() && Number(count.get([])[0] ?? 0) >= 1_000) {
          throw new Error("The offline command queue is full.");
        }
      } finally {
        count.finalize();
      }
      if (mutation.item) appItemBundle.upsertRow(db, mutation.item);
      else if (mutation.itemId) appItemBundle.deleteRows(db, [mutation.itemId]);
      else throw new Error("Item mutation requires an item or itemId.");
      enqueueOfflineCommand(db, mutation.command);
    });
    return null;
  },
});

const appOfflineMaintenanceHandlers = createSqliteRequestHandlers({
  ensureOfflineOwner: (db, request) => {
    const { owner } = request as unknown as { owner: string };
    if (!owner) throw new Error("Offline data requires an authenticated owner.");

    const ownerStatement = db.prepare("SELECT value FROM offline_metadata WHERE key = 'owner';");
    let previousOwner: string | null = null;
    try {
      if (ownerStatement.step()) previousOwner = String(ownerStatement.get([])[0]);
    } finally {
      ownerStatement.finalize();
    }

    runSqliteTransaction(db, () => {
      // Missing metadata is not proof that durable rows belong to this user.
      // Purging an empty new database is harmless and makes schema upgrades fail closed.
      if (previousOwner !== owner) {
        db.exec("DELETE FROM items_cache;");
        db.exec("DELETE FROM offline_sync_commands;");
        db.exec("DELETE FROM hydration_entity_state;");
      }
      const persistOwner = db.prepare(`
        INSERT INTO offline_metadata (key, value) VALUES ('owner', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
      `);
      try {
        persistOwner.bind([owner]).step();
      } finally {
        persistOwner.finalize();
      }
    });
    return { previousOwner, purged: previousOwner !== owner };
  },
  clearOfflineQueue: db => {
    db.exec("DELETE FROM offline_sync_commands;");
    return null;
  },
  clearOfflineData: db => {
    runSqliteTransaction(db, () => {
      db.exec("DELETE FROM items_cache;");
      db.exec("DELETE FROM offline_sync_commands;");
      db.exec("DELETE FROM hydration_entity_state;");
      db.exec("DELETE FROM offline_metadata;");
    });
    return null;
  },
  discardOfflineChanges: db => {
    runSqliteTransaction(db, () => {
      db.exec("DELETE FROM offline_sync_commands;");
      // A pending or conflicted row no longer has an authoritative local value.
      // Remove it before hydration rather than showing an unqueued local write.
      db.exec("DELETE FROM items_cache WHERE pending = 1 OR conflict = 1;");
    });
    return null;
  },
  rebaseOfflineCommands: (db, request) => {
    const { authoritativeItems, cachedItems } = request as unknown as {
      authoritativeItems: AuthoritativeItemState[];
      cachedItems: CachedOfflineItemState[];
    };
    runSqliteTransaction(db, () => {
      const queued = db.prepare(`
        SELECT command_id, method, url, body_json, headers_json, created_at
        FROM offline_sync_commands
        WHERE status IN ('PENDING', 'PERMANENTLY_FAILED')
        ORDER BY created_at ASC, command_id ASC;
      `);
      const commands: OfflineItemCommand[] = [];
      try {
        while (queued.step()) {
          const row = queued.get([]);
          commands.push({
            commandId: String(row[0]),
            method: String(row[1]),
            url: String(row[2]),
            body: JSON.parse(String(row[3])),
            headers: JSON.parse(String(row[4])) as Record<string, string>,
            createdAt: Number(row[5]),
          });
        }
      } finally {
        queued.finalize();
      }
      const rebased = rebaseOfflineItemCommands(commands, authoritativeItems, cachedItems);
      db.exec("DELETE FROM offline_sync_commands WHERE status IN ('PENDING', 'PERMANENTLY_FAILED');");
      for (const itemId of rebased.affectedItemIds) {
        const clearFlags = db.prepare("UPDATE items_cache SET pending = 0, conflict = 0 WHERE id = ?;");
        try {
          clearFlags.bind([itemId]).step();
        } finally {
          clearFlags.finalize();
        }
      }
      if (rebased.deletedItemIds.length) appItemBundle.deleteRows(db, rebased.deletedItemIds);
      for (const command of rebased.commands) {
        const itemId = offlineItemIdFor(command);
        const flags = db.prepare("UPDATE items_cache SET pending = 1, conflict = 0 WHERE id = ?;");
        try {
          flags.bind([itemId]).step();
        } finally {
          flags.finalize();
        }
        enqueueOfflineCommand(db, command);
      }
    });
    return null;
  },
});

const appItemQueryHandlers = createSqliteRequestHandlers({
  executeParameterizedItemPagedQuery: (db, request) =>
    executeParameterizedSqlitePagedQuery(db, (request as unknown as { query: never }).query),
  executeParameterizedItemQuery: (db, request) =>
    executeParameterizedSqliteQuery(db, (request as unknown as { query: never }).query),
});

export const appOfflineWorkerConfig = createSqliteWorkerRuntimeConfig({
  dbFile: APP_OFFLINE_DATABASE_FILE,
  migrations: APP_OFFLINE_MIGRATIONS,
  entityBundles: [appItemBundle],
  extraRequestHandlers: [
    OFFLINE_QUEUE_STATE_SQLITE_REQUEST_HANDLERS,
    HYDRATION_ENTITY_STATE_SQLITE_REQUEST_HANDLERS,
    appItemMutationHandlers,
    appItemQueryHandlers,
    appOfflineMaintenanceHandlers,
  ],
});
