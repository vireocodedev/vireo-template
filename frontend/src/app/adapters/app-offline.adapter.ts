import axios from "axios";
import { z } from "zod";
import {
  bindSqliteSearchColumns,
  createSqliteQueryExecutor,
  type ParameterizedSqlitePagedQueryResult,
  type ParameterizedSqliteQueryResult,
} from "@vireocodedev/query";
import { appAxios } from "@/app/data/network/clients/AppAxiosClient";
import { configureItemApi, Item, ItemApiOnline, type ItemApi, type ItemFilters } from "@/features/item/public";
import { APP_QUERY_ENTITY } from "@/app/data/query/models/AppQueryEntityKey";
import { serializeQueryFilterDocument } from "@/app/data/query/models/QueryFilterDocument";
import type { PageableParams, PageableResponse } from "@vireocodedev/infrastructure";
import {
  offlineItemIdFor,
  rebaseOfflineItemCommands,
  type AuthoritativeItemVersion,
  type OfflineItemCommand,
} from "../offline/services/app-offline-rebase";
import { runOfflineRecovery } from "../offline/services/app-offline-hydration";
import { withAppOfflineLock } from "../offline/services/app-offline-lock";
import { patchCacheReadiness, patchOfflineSimulation, patchSyncSummary } from "../offline/actions/app-offline-actions";
import { CacheStatus, ConnectivityStatus, SyncStatus } from "../offline/models/AppOffline";
import { sigConnectivityStatus } from "../offline/signals/sigConnectivityStatus";
import { sigCacheReadiness } from "../offline/signals/sigCacheReadiness";
import { sigOfflineSimulation } from "../offline/signals/sigOfflineSimulation";
import { sigSyncSummary } from "../offline/signals/sigSyncSummary";
import {
  appOfflineHydration,
  appOfflineItems,
  appOfflineQueue,
  appOfflineRuntime,
  appOfflineTransport,
  type CachedItem,
} from "../offline/sqlite/app-offline-sqlite";

const CURRENT_USER_STORAGE_KEY = "starter-template:offline-current-user";
const CURRENT_USER_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const ITEM_HYDRATION_KEY = "Item";
const MAX_OFFLINE_COMMANDS = 1_000;
const REPLAY_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;
let lastCommandCreatedAt = 0;
let notifyItemsHydrated: (() => void | Promise<void>) | undefined;
const queuedCommandsForInMemoryRetry = new Map<string, OfflineItemCommand>();
const failedCommandsForInMemoryRetry = new Map<string, OfflineItemCommand>();
let inMemoryOfflineOwner: string | null = null;
const itemSearchBindings = bindSqliteSearchColumns([
  { alias: "id", expression: "id", valueType: "string", filterAs: false },
  { alias: "name", expression: "name", valueType: "string" },
  { alias: "description", expression: "description", valueType: "string" },
  { alias: "quantity", expression: "quantity", valueType: "number" },
  { alias: "status", expression: "status", valueType: "string" },
  { alias: "version", expression: "version", valueType: "number", filterAs: false },
  { alias: "pending", expression: "pending", valueType: "number", filterAs: false, sortAs: false },
  { alias: "conflict", expression: "conflict", valueType: "number", filterAs: false, sortAs: false },
] as const);

const itemQueryExecutor = createSqliteQueryExecutor({
  executePagedQuery: request =>
    appOfflineTransport.sendWorkerRequest<ParameterizedSqlitePagedQueryResult>({
      type: "executeParameterizedItemPagedQuery",
      query: request,
    }),
  executeQuery: request =>
    appOfflineTransport.sendWorkerRequest<ParameterizedSqliteQueryResult>({
      type: "executeParameterizedItemQuery",
      query: request,
    }),
});

const CachedCurrentUser = z.object({
  id: z.uuid(),
  username: z.string().min(1),
  role: z.enum(["USER", "SUPERADMIN"]).nullable(),
  validatedAt: z.number().int().nonnegative(),
});

export type AppOfflineCurrentUser = z.infer<typeof CachedCurrentUser>;

export type AppOfflineShowcaseTransport = {
  currentUser: () => Promise<AppOfflineCurrentUser>;
  searchItems: (pageable: PageableParams, filters: ItemFilters) => Promise<PageableResponse<Item>>;
  replay: (commands: Awaited<ReturnType<typeof appOfflineQueue.getBatch>>) => Promise<unknown>;
};

const httpOfflineShowcaseTransport: AppOfflineShowcaseTransport = {
  currentUser: async () => {
    const response = await appAxios.get("/app/current-user", { timeout: 8_000 });
    return CachedCurrentUser.parse({ ...response.data, validatedAt: Date.now() });
  },
  searchItems: (pageable, filters) => new ItemApiOnline().search(pageable, filters),
  replay: async commands => (await appAxios.post("/offline/sync", { commands }, { timeout: 10_000 })).data,
};

let offlineShowcaseTransport = httpOfflineShowcaseTransport;

export function configureOfflineShowcaseTransport(transport: AppOfflineShowcaseTransport | undefined): void {
  offlineShowcaseTransport = transport ?? httpOfflineShowcaseTransport;
}

/** The React/query layer opts into cache refresh without coupling this adapter to its QueryClient. */
export function configureOfflineItemsHydratedListener(listener: (() => void | Promise<void>) | undefined): void {
  notifyItemsHydrated = listener;
}

function localStorageOrNull(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readCachedOfflineCurrentUser(now = Date.now()): AppOfflineCurrentUser | null {
  try {
    const value = localStorageOrNull()?.getItem(CURRENT_USER_STORAGE_KEY);
    const parsed = value ? CachedCurrentUser.safeParse(JSON.parse(value)) : null;
    return parsed?.success && now - parsed.data.validatedAt <= CURRENT_USER_MAX_AGE_MS ? parsed.data : null;
  } catch {
    return null;
  }
}

function persistCurrentUser(user: AppOfflineCurrentUser): void {
  try {
    localStorageOrNull()?.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // Local cache remains optional when browser storage is unavailable.
  }
}

export function clearOfflineCurrentUser(): void {
  try {
    localStorageOrNull()?.removeItem(CURRENT_USER_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
}

/** Storage cleanup failed; keep the authenticated application online-only until a later successful hydration. */
export function markOfflineCacheUnavailable(error: unknown): void {
  markOfflineStorageUnavailable(error);
}

function toCached(item: Item, pending = false, conflict = false, deleted = false): CachedItem {
  return { ...item, pending, conflict, deleted };
}

function nextCommandTimestamp(): number {
  lastCommandCreatedAt = Math.max(Date.now(), lastCommandCreatedAt + 1);
  return lastCommandCreatedAt;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => globalThis.setTimeout(resolve, milliseconds));
}

function canQueueOfflineMutation(error: unknown): boolean {
  return (
    sigConnectivityStatus.value === ConnectivityStatus.OFFLINE ||
    (axios.isAxiosError(error) && (!error.response || error.response.status === 503))
  );
}

function canRetryOfflineReplay(error: unknown): boolean {
  return (
    sigConnectivityStatus.value === ConnectivityStatus.OFFLINE ||
    (axios.isAxiosError(error) && (!error.response || error.response.status === 503))
  );
}

async function refreshSyncSummary(): Promise<void> {
  const counts = await appOfflineQueue.getStatusCounts();
  patchSyncSummary({
    failed: counts.permanentlyFailed,
    pending: counts.pending,
    status: counts.permanentlyFailed > 0 ? SyncStatus.BLOCKED : sigSyncSummary.value.status,
  });
}

function offlineStoragePrerequisiteError(): string | null {
  if (appOfflineRuntime.shouldUseInMemoryFallback()) return null;
  if (globalThis.crossOriginIsolated !== true || typeof SharedArrayBuffer === "undefined") {
    return "Offline storage requires a cross-origin-isolated page. Reload the app; if it remains unavailable, use HTTPS or localhost and verify the COOP/COEP headers.";
  }
  const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
  if (typeof storage?.getDirectory !== "function") {
    return "Offline storage requires browser OPFS support.";
  }
  return null;
}

function canUseOfflineStorage(): boolean {
  return (
    appOfflineRuntime.shouldUseInMemoryFallback() ||
    sigCacheReadiness.value.status === CacheStatus.READY ||
    sigCacheReadiness.value.status === CacheStatus.STALE
  );
}

function offlineStorageError(): Error {
  return new Error(sigCacheReadiness.value.error ?? "The offline Item cache is unavailable.");
}

function markOfflineStorageUnavailable(error: unknown): void {
  patchOfflineSimulation({ enabled: false });
  patchCacheReadiness({
    error: error instanceof Error ? error.message : "Local offline storage is unavailable.",
    status: CacheStatus.UNAVAILABLE,
  });
}

async function ensureOfflineStorage(): Promise<boolean> {
  if (!canUseOfflineStorage()) await initializeOfflineData();
  return canUseOfflineStorage();
}

export async function initializeOfflineData(): Promise<void> {
  // A failed worker bootstrap must not be retried through every offline route.
  if (sigCacheReadiness.value.status === CacheStatus.UNAVAILABLE && sigCacheReadiness.value.error !== null) return;
  patchCacheReadiness({ error: null, status: CacheStatus.HYDRATING });
  const prerequisiteError = offlineStoragePrerequisiteError();
  if (prerequisiteError) {
    markOfflineStorageUnavailable(new Error(prerequisiteError));
    return;
  }
  try {
    // The fallback queue is intentionally tab-memory-only. Do not retain retry
    // metadata after its runtime has been initialized/reset for a new tab state.
    if (appOfflineRuntime.shouldUseInMemoryFallback()) {
      queuedCommandsForInMemoryRetry.clear();
      failedCommandsForInMemoryRetry.clear();
      inMemoryOfflineOwner = null;
    }
    if (!appOfflineRuntime.shouldUseInMemoryFallback()) await appOfflineRuntime.warmup();
    const states = await appOfflineHydration.list();
    const itemState = states.find(state => state.entityKey === ITEM_HYDRATION_KEY);
    patchCacheReadiness({ status: itemState?.isStale === false ? CacheStatus.READY : CacheStatus.STALE });
    await refreshSyncSummary();
  } catch (error) {
    markOfflineStorageUnavailable(error);
  }
}

export async function validateOfflineCurrentUser(): Promise<AppOfflineCurrentUser | null> {
  if (sigConnectivityStatus.value === ConnectivityStatus.OFFLINE) {
    const cachedUser = readCachedOfflineCurrentUser();
    if (!cachedUser || !(await ensureOfflineStorage())) return null;
    await withAppOfflineLock(() => ensureOfflineOwnerUnlocked(cachedUser.id));
    return cachedUser;
  }
  return validateLiveOfflineCurrentUser();
}

/** Validates the server identity even before the heartbeat has established online connectivity. */
export async function validateLiveOfflineCurrentUser(): Promise<AppOfflineCurrentUser> {
  return withAppOfflineLock(validateLiveOfflineCurrentUserUnlocked);
}

async function validateLiveOfflineCurrentUserUnlocked(): Promise<AppOfflineCurrentUser> {
  const user = await offlineShowcaseTransport.currentUser();
  if (!(await ensureOfflineStorage())) throw offlineStorageError();
  await ensureOfflineOwnerUnlocked(user.id);
  persistCurrentUser(user);
  return user;
}

async function ensureOfflineOwnerUnlocked(owner: string): Promise<void> {
  if (appOfflineRuntime.shouldUseInMemoryFallback()) {
    if (inMemoryOfflineOwner && inMemoryOfflineOwner !== owner) {
      appOfflineRuntime.clearInMemoryStores();
      queuedCommandsForInMemoryRetry.clear();
      failedCommandsForInMemoryRetry.clear();
    }
    inMemoryOfflineOwner = owner;
    return;
  }
  await appOfflineTransport.sendWorkerRequest({ type: "ensureOfflineOwner", owner });
}

async function fetchAuthoritativeItems(): Promise<Item[]> {
  const remoteItems: Item[] = [];
  for (let pageNumber = 0; ; pageNumber += 1) {
    const page = await offlineShowcaseTransport.searchItems(
      { page: pageNumber, rowsPerPage: 100, sortBy: "name", sortDirection: "asc" },
      { searchText: "", queryFilters: null },
    );
    remoteItems.push(...page.content);
    if (pageNumber + 1 >= page.totalPages) return remoteItems;
  }
}

/** Fetches the admitted Item domain as one bounded snapshot. Generated entities remain remote-only. */
export async function hydrateOfflineItems(): Promise<void> {
  if (sigConnectivityStatus.value !== ConnectivityStatus.ONLINE || !(await ensureOfflineStorage())) return;
  await withAppOfflineLock(hydrateOfflineItemsUnlocked);
}

async function hydrateOfflineItemsUnlocked(): Promise<void> {
  if (!canUseOfflineStorage()) return;
  patchCacheReadiness({ error: null, status: CacheStatus.HYDRATING });
  try {
    const remoteItems = await fetchAuthoritativeItems();
    const localItems = await appOfflineItems.list();
    const localChanges = new Map(
      localItems.filter(item => item.pending || item.conflict).map(item => [item.id, item] as const),
    );
    const merged = remoteItems.map(item => localChanges.get(item.id) ?? toCached(item));
    const remoteIds = new Set(remoteItems.map(item => item.id));
    merged.push(...[...localChanges.values()].filter(item => !remoteIds.has(item.id)));
    await appOfflineItems.replace(merged);
    await appOfflineHydration.upsert({
      entityKey: ITEM_HYDRATION_KEY,
      appliedRevision: 0,
      isStale: false,
      lastHydratedAt: Date.now(),
      lastRowCount: remoteItems.length,
      lastError: null,
    });
    patchCacheReadiness({ error: null, status: CacheStatus.READY });
    await notifyItemsHydrated?.();
  } catch (error) {
    try {
      await appOfflineHydration.upsert({
        entityKey: ITEM_HYDRATION_KEY,
        appliedRevision: 0,
        isStale: true,
        lastHydratedAt: null,
        lastRowCount: null,
        lastError: error instanceof Error ? error.message : "Hydration failed.",
      });
    } catch (storageError) {
      markOfflineStorageUnavailable(storageError);
      return;
    }
    patchCacheReadiness({
      error: error instanceof Error ? error.message : "Hydration failed.",
      status: CacheStatus.STALE,
    });
  }
}

export async function applyQueuedItemMutation(
  item: CachedItem | null,
  itemId: string,
  command: { method: string; url: string; body: unknown | null },
): Promise<void> {
  if (!(await ensureOfflineStorage())) throw offlineStorageError();
  await withAppOfflineLock(async () => {
    const queuedCommand = {
      commandId: crypto.randomUUID(),
      createdAt: nextCommandTimestamp(),
      headers: {},
      ...command,
    };
    if (appOfflineRuntime.shouldUseInMemoryFallback()) {
      if ((await appOfflineQueue.getSize()) >= MAX_OFFLINE_COMMANDS)
        throw new Error("The offline command queue is full.");
      if (item) await appOfflineItems.upsert(item);
      else await appOfflineItems.delete([itemId]);
      await appOfflineQueue.enqueue(queuedCommand);
      queuedCommandsForInMemoryRetry.set(queuedCommand.commandId, queuedCommand);
      return;
    }
    await appOfflineTransport.sendWorkerRequest({
      type: "applyItemMutation",
      item: item ?? undefined,
      itemId: item ? undefined : itemId,
      command: queuedCommand,
    });
  });
  await refreshSyncSummary();
}

export async function replayOfflineItems(): Promise<void> {
  if (sigConnectivityStatus.value !== ConnectivityStatus.ONLINE || !(await ensureOfflineStorage())) return;
  const queued = await appOfflineQueue.getSize();
  if (queued === 0) return;
  const currentUser = await validateOfflineCurrentUser();
  if (currentUser?.role !== "SUPERADMIN") {
    patchSyncSummary({
      error: "Your current role cannot replay queued Item changes.",
      status: SyncStatus.BLOCKED,
    });
    return;
  }
  await withAppOfflineLock(replayOfflineItemsUnlocked);
}

/** Validates ownership, replays queued intent, and hydrates one authoritative snapshot atomically. */
export async function recoverOfflineItems(): Promise<void> {
  if (sigConnectivityStatus.value !== ConnectivityStatus.ONLINE || !(await ensureOfflineStorage())) return;
  await runOfflineRecovery(async () => {
    const currentUser = await validateLiveOfflineCurrentUserUnlocked();
    if (currentUser.role !== "SUPERADMIN") {
      patchSyncSummary({
        error: "Your current role cannot replay queued Item changes.",
        status: SyncStatus.BLOCKED,
      });
      return;
    }
    await replayOfflineItemsUnlocked();
  }, hydrateOfflineItemsUnlocked);
}

const ReplayResponse = z.object({
  results: z.array(
    z.object({
      commandId: z.string(),
      success: z.boolean(),
      status: z.number(),
      error: z.string().nullable(),
      reason: z.enum(["APPLIED", "ALREADY_APPLIED", "RETRYABLE", "REJECTED", "RETRY_LIMIT_EXCEEDED"]).nullable(),
    }),
  ),
});

function commandItemId(command: { body: unknown; url: string }): string | null {
  return command.url.match(/\/api\/items\/([^/]+)$/u)?.[1] ?? (command.body as { id?: string } | null)?.id ?? null;
}

async function applyReplayOutcomes(
  commands: Awaited<ReturnType<typeof appOfflineQueue.getBatch>>,
  results: z.infer<typeof ReplayResponse>["results"],
): Promise<void> {
  const resultById = new Map(results.map(result => [result.commandId, result] as const));
  const outcomeByItem = new Map<string, "success" | "retry" | "conflict">();
  for (const command of commands) {
    const itemId = commandItemId(command);
    if (!itemId) continue;
    const result = resultById.get(command.commandId);
    const outcome = result?.success
      ? "success"
      : result?.reason === "REJECTED" || result?.reason === "RETRY_LIMIT_EXCEEDED"
        ? "conflict"
        : "retry";
    const previous = outcomeByItem.get(itemId);
    if (previous !== "conflict" && (outcome === "conflict" || previous !== "retry")) outcomeByItem.set(itemId, outcome);
    if (outcome === "success") {
      queuedCommandsForInMemoryRetry.delete(command.commandId);
      failedCommandsForInMemoryRetry.delete(command.commandId);
    } else if (outcome === "conflict") {
      failedCommandsForInMemoryRetry.set(command.commandId, command);
    }
  }
  const localItems = await appOfflineItems.list();
  for (const [itemId, outcome] of outcomeByItem) {
    const item = localItems.find(candidate => candidate.id === itemId);
    if (!item) continue;
    await appOfflineItems.upsert({
      ...item,
      conflict: outcome === "conflict",
      deleted: outcome === "conflict" ? false : item.deleted,
      pending: outcome === "retry",
    });
  }
}

async function replayOfflineItemsUnlocked(): Promise<void> {
  patchSyncSummary({ error: null, status: SyncStatus.SYNCING });
  let retryIndex = 0;
  let synchronizedCount = 0;
  for (;;) {
    if (sigConnectivityStatus.value !== ConnectivityStatus.ONLINE) {
      patchSyncSummary({ status: SyncStatus.IDLE });
      return;
    }
    // The server can accept up to 50 commands, but dependency ordering requires a
    // barrier after every command: a permanent result must stop later commands.
    const commands = await appOfflineQueue.getBatch(1);
    if (!commands.length) break;
    let results: z.infer<typeof ReplayResponse>["results"];
    try {
      if (sigOfflineSimulation.value.failNextReplay) {
        patchOfflineSimulation({ failNextReplay: false });
        throw new axios.AxiosError("Simulated replay failure", "ERR_NETWORK");
      }
      results = ReplayResponse.parse(await offlineShowcaseTransport.replay(commands)).results;
      if (results.length !== 1 || results[0]?.commandId !== commands[0]?.commandId) {
        patchSyncSummary({ error: "Replay returned an invalid command result.", status: SyncStatus.BLOCKED });
        return;
      }
    } catch (error) {
      if (!canRetryOfflineReplay(error)) {
        patchSyncSummary({
          error: error instanceof Error ? error.message : "Replay failed.",
          status: SyncStatus.BLOCKED,
        });
        return;
      }
      await appOfflineQueue.markRetryable(
        commands.map(command => command.commandId),
        error instanceof Error ? error.message : "Replay temporarily failed.",
        REPLAY_BACKOFF_MS.length,
      );
      await refreshSyncSummary();
      if (appOfflineRuntime.shouldUseInMemoryFallback() && retryIndex + 1 >= REPLAY_BACKOFF_MS.length) {
        for (const command of commands) failedCommandsForInMemoryRetry.set(command.commandId, command);
      }
      if (sigSyncSummary.value.failed > 0) break;
      await delay(REPLAY_BACKOFF_MS[Math.min(retryIndex, REPLAY_BACKOFF_MS.length - 1)]);
      retryIndex += 1;
      continue;
    }

    const successful = results.filter(result => result.success).map(result => result.commandId);
    synchronizedCount += successful.length;
    const permanent = results.filter(
      result => !result.success && (result.reason === "REJECTED" || result.reason === "RETRY_LIMIT_EXCEEDED"),
    );
    const retryable = results.filter(result => !result.success && !permanent.includes(result));
    if (successful.length) await appOfflineQueue.delete(successful);
    if (permanent.length) {
      await appOfflineQueue.markPermanentlyFailed(
        permanent.map(result => result.commandId),
        permanent[0]?.error ?? null,
      );
    }
    if (retryable.length) {
      await appOfflineQueue.markRetryable(
        retryable.map(result => result.commandId),
        retryable[0]?.error ?? null,
        REPLAY_BACKOFF_MS.length,
      );
    }
    await applyReplayOutcomes(commands, results);
    await refreshSyncSummary();
    if (permanent.length || sigSyncSummary.value.failed > 0) break;
    if (retryable.length) {
      await delay(REPLAY_BACKOFF_MS[Math.min(retryIndex, REPLAY_BACKOFF_MS.length - 1)]);
      retryIndex += 1;
    } else {
      retryIndex = 0;
    }
  }
  await refreshSyncSummary();
  if (sigSyncSummary.value.failed > 0) {
    patchSyncSummary({ error: "Queued Item changes need attention.", status: SyncStatus.BLOCKED });
    return;
  }
  patchSyncSummary({
    error: null,
    lastSynchronizedCount: synchronizedCount,
    status: SyncStatus.IDLE,
    synchronizationSequence:
      synchronizedCount > 0
        ? sigSyncSummary.value.synchronizationSequence + 1
        : sigSyncSummary.value.synchronizationSequence,
  });
}

async function sendOfflineMaintenanceRequest(type: string): Promise<void> {
  if (appOfflineRuntime.shouldUseInMemoryFallback()) {
    if (type === "discardOfflineChanges" || type === "clearOfflineData") {
      appOfflineRuntime.clearInMemoryStores();
      queuedCommandsForInMemoryRetry.clear();
      failedCommandsForInMemoryRetry.clear();
    }
    return;
  }
  await appOfflineTransport.sendWorkerRequest({ type });
}

export async function retryOfflineChanges(): Promise<void> {
  if (sigConnectivityStatus.value !== ConnectivityStatus.ONLINE) {
    patchSyncSummary({ error: "Reconnect before rebasing queued Item changes.", status: SyncStatus.BLOCKED });
    return;
  }
  if (!(await ensureOfflineStorage())) return;
  await runOfflineRecovery(
    async () => {
      await validateLiveOfflineCurrentUserUnlocked();
      const authoritativeItems = await fetchAuthoritativeItems();
      const authoritativeVersions: AuthoritativeItemVersion[] = authoritativeItems.map(item => ({
        id: item.id,
        version: item.version,
      }));
      if (appOfflineRuntime.shouldUseInMemoryFallback()) {
        const queued = [...queuedCommandsForInMemoryRetry.values()];
        if (queued.length === 0 && sigSyncSummary.value.failed > 0) {
          throw new Error("Failed offline commands cannot be retried after this tab's in-memory cache was reset.");
        }
        if (queued.length) {
          const rebased = rebaseOfflineItemCommands(queued, authoritativeVersions);
          await appOfflineQueue.delete(queued.map(command => command.commandId));
          if (rebased.deletedItemIds.length) await appOfflineItems.delete(rebased.deletedItemIds);
          for (const command of rebased.commands) {
            const itemId = offlineItemIdFor(command);
            const local = (await appOfflineItems.list()).find(item => item.id === itemId);
            if (local) await appOfflineItems.upsert({ ...local, conflict: false, pending: true });
            await appOfflineQueue.enqueue(command);
          }
          queuedCommandsForInMemoryRetry.clear();
          for (const command of rebased.commands) queuedCommandsForInMemoryRetry.set(command.commandId, command);
          failedCommandsForInMemoryRetry.clear();
        }
      } else {
        await appOfflineTransport.sendWorkerRequest({
          type: "rebaseOfflineCommands",
          authoritativeItems: authoritativeVersions,
        });
      }
      patchSyncSummary({ error: null, status: SyncStatus.IDLE });
      await refreshSyncSummary();
      await replayOfflineItemsUnlocked();
    },
    hydrateOfflineItemsUnlocked,
    "manual",
  );
}

export async function discardOfflineChanges(): Promise<void> {
  if (!(await ensureOfflineStorage())) return;
  await withAppOfflineLock(async () => sendOfflineMaintenanceRequest("discardOfflineChanges"));
  patchSyncSummary({ error: null, failed: 0, pending: 0, status: SyncStatus.IDLE });
  await hydrateOfflineItems();
}

export async function resetOfflineCache(): Promise<void> {
  // Reset deliberately clears a previous initialization failure so a user can retry
  // after reloading into an OPFS-capable document.
  patchCacheReadiness({ error: null, status: CacheStatus.UNAVAILABLE });
  await purgeOfflineData();
  if (!appOfflineRuntime.shouldUseInMemoryFallback()) appOfflineRuntime.reset();
  await initializeOfflineData();
  if (sigConnectivityStatus.value === ConnectivityStatus.ONLINE && canUseOfflineStorage()) {
    await recoverOfflineItems();
  }
}

/** Removes the admitted domain and queued commands before another authenticated owner can use this tab. */
export async function purgeOfflineData(): Promise<void> {
  if (!(await ensureOfflineStorage())) return;
  await withAppOfflineLock(async () => sendOfflineMaintenanceRequest("clearOfflineData"));
  inMemoryOfflineOwner = null;
  patchCacheReadiness({ error: null, status: CacheStatus.STALE });
  patchSyncSummary({ error: null, failed: 0, pending: 0, status: SyncStatus.IDLE });
}

export class ItemApiOfflineCapable implements ItemApi {
  constructor(private readonly online: ItemApi = new ItemApiOnline()) {}

  async search(pageable: PageableParams, filters: ItemFilters): Promise<PageableResponse<Item>> {
    if (
      sigConnectivityStatus.value === ConnectivityStatus.OFFLINE &&
      (sigCacheReadiness.value.status === CacheStatus.UNAVAILABLE ||
        sigCacheReadiness.value.status === CacheStatus.HYDRATING)
    ) {
      await initializeOfflineData();
    }
    if (
      appOfflineRuntime.shouldUseInMemoryFallback() &&
      sigCacheReadiness.value.status !== CacheStatus.UNAVAILABLE &&
      sigCacheReadiness.value.status !== CacheStatus.HYDRATING
    ) {
      const search = filters.searchText.trim().toLocaleLowerCase();
      const cached = (await appOfflineItems.list()).filter(
        item =>
          !item.deleted &&
          (!search || `${item.name} ${item.description} ${item.status}`.toLocaleLowerCase().includes(search)),
      );
      const sortKey = pageable.sortBy as keyof Item;
      cached.sort((left, right) => {
        const comparison = String(left[sortKey]).localeCompare(String(right[sortKey]), undefined, { numeric: true });
        return pageable.sortDirection === "desc" ? -comparison : comparison;
      });
      const start = pageable.page * pageable.rowsPerPage;
      return {
        content: cached.slice(start, start + pageable.rowsPerPage),
        number: pageable.page,
        size: pageable.rowsPerPage,
        totalElements: cached.length,
        totalPages: Math.ceil(cached.length / pageable.rowsPerPage),
      };
    }
    if (
      sigCacheReadiness.value.status !== CacheStatus.UNAVAILABLE &&
      sigCacheReadiness.value.status !== CacheStatus.HYDRATING &&
      !appOfflineRuntime.shouldUseInMemoryFallback()
    ) {
      try {
        return await itemQueryExecutor.pagedSearch({
          adapter: {
            entity: APP_QUERY_ENTITY.item,
            fromClause: "items_cache",
            baseWhereClause: "deleted = 0",
            keyExpression: "id",
            keyAlias: "id",
            fieldAdapters: itemSearchBindings.fieldAdapters,
            parseKey: value => String(value),
          },
          queryFiltersJson: serializeQueryFilterDocument(filters.queryFilters, APP_QUERY_ENTITY.item),
          pageable,
          selectColumns: itemSearchBindings.selectColumns,
          sortBy: pageable.sortBy,
          sortDirection: pageable.sortDirection,
          defaultSortExpression: "name ASC, id ASC",
          sortExpressionsByKey: itemSearchBindings.sortExpressionsByKey,
          // The published executor binds every statement; a match-all search keeps
          // the empty-filter query parameterized as well.
          searchText: filters.searchText.trim() || "%",
          searchExpressions: ["name", "description", "status"],
          mapRow: (row, indexes) =>
            Object.assign(
              Item.parse({
                id: row[indexes.id],
                name: row[indexes.name],
                description: row[indexes.description],
                quantity: row[indexes.quantity],
                status: row[indexes.status],
                version: row[indexes.version],
              }),
              { pending: Number(row[indexes.pending]) === 1, conflict: Number(row[indexes.conflict]) === 1 },
            ),
        });
      } catch {
        // An unavailable local cache is handled below without changing connectivity.
      }
    }
    if (sigConnectivityStatus.value === ConnectivityStatus.OFFLINE) {
      throw new Error(sigCacheReadiness.value.error ?? "The offline Item cache is unavailable.");
    }
    return this.online.search(pageable, filters);
  }

  async create(value: Item) {
    try {
      if (sigConnectivityStatus.value !== ConnectivityStatus.ONLINE) throw new Error("Offline simulation");
      const result = await this.online.create(value);
      if (canUseOfflineStorage())
        await appOfflineItems.upsert(toCached(result.value)).catch(markOfflineStorageUnavailable);
      return result;
    } catch (error) {
      if (!canQueueOfflineMutation(error)) throw error;
      const local = toCached({ ...value, version: 0 }, true);
      await applyQueuedItemMutation(local, local.id, {
        method: "POST",
        url: "/api/items",
        body: { ...value, version: 0 },
      });
      return { persistence: "QUEUED" as const, value: local };
    }
  }

  async update(id: string, value: Item) {
    try {
      if (sigConnectivityStatus.value !== ConnectivityStatus.ONLINE) throw new Error("Offline simulation");
      const result = await this.online.update(id, value);
      if (canUseOfflineStorage())
        await appOfflineItems.upsert(toCached(result.value)).catch(markOfflineStorageUnavailable);
      return result;
    } catch (error) {
      if (!canQueueOfflineMutation(error)) throw error;
      const local = toCached({ ...value, id, version: value.version + 1 }, true);
      await applyQueuedItemMutation(local, id, { method: "PUT", url: `/api/items/${id}`, body: value });
      return { persistence: "QUEUED" as const, value: local };
    }
  }

  async delete(id: string, version: number) {
    let local: CachedItem | undefined;
    if (canUseOfflineStorage()) {
      try {
        local = (await appOfflineItems.list()).find(item => item.id === id);
      } catch (error) {
        markOfflineStorageUnavailable(error);
      }
    }
    try {
      if (sigConnectivityStatus.value !== ConnectivityStatus.ONLINE) throw new Error("Offline simulation");
      const result = await this.online.delete(id, version);
      if (canUseOfflineStorage()) await appOfflineItems.delete([id]).catch(markOfflineStorageUnavailable);
      return result;
    } catch (error) {
      if (!canQueueOfflineMutation(error)) throw error;
      if (!local) throw new Error(`Cannot queue deletion for uncached Item ${id}.`, { cause: error });
      await applyQueuedItemMutation({ ...local, deleted: true, pending: true }, id, {
        method: "DELETE",
        url: `/api/items/${id}`,
        body: { version: local?.version ?? version },
      });
      return { persistence: "QUEUED" as const, value: undefined };
    }
  }
}

export function installOfflineItemAdapter(online: ItemApi = new ItemApiOnline()): void {
  configureItemApi(new ItemApiOfflineCapable(online));
}
