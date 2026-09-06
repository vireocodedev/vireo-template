export type CachedOfflineItemState = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  version: number;
};

export type AuthoritativeItemState = Omit<CachedOfflineItemState, "description"> & {
  description: string | null;
};

export type OfflineItemCommand = {
  body: unknown;
  commandId: string;
  createdAt: number;
  headers: Record<string, string>;
  method: string;
  url: string;
};

export type RebasedOfflineItemCommands = {
  affectedItemIds: string[];
  commands: OfflineItemCommand[];
  deletedItemIds: string[];
};

const MUTABLE_ITEM_FIELDS = ["name", "description", "quantity", "status"] as const;
type MutableItemField = (typeof MUTABLE_ITEM_FIELDS)[number];
type MutableItemState = Record<MutableItemField, unknown>;
type ItemRevision = { exists: boolean; state: MutableItemState | null; version: number };

export function offlineItemIdFor(command: Pick<OfflineItemCommand, "body" | "url">): string {
  const urlId = command.url.match(/\/api\/items\/([^/]+)$/u)?.[1];
  const bodyId = isObject(command.body) && typeof command.body.id === "string" ? command.body.id : undefined;
  const itemId = urlId ?? bodyId;
  if (!itemId) throw new Error("Cannot rebase an offline Item command without an Item ID.");
  return itemId;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireCompleteMutableState(
  command: OfflineItemCommand,
  itemId: string,
  cachedItems: ReadonlyMap<string, CachedOfflineItemState>,
): CachedOfflineItemState {
  const cached = cachedItems.get(itemId);
  if (!cached) {
    throw new Error(
      `Cannot rebase PATCH command ${command.commandId}: the Item is missing on the server and no complete cached Item state remains.`,
    );
  }
  return cached;
}

function createBody(item: CachedOfflineItemState): Record<string, unknown> {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    status: item.status,
  };
}

function createBodyFromCommand(command: OfflineItemCommand, itemId: string): Record<string, unknown> {
  if (!isObject(command.body))
    throw new Error(`Cannot rebase Item command ${command.commandId} with a non-object body.`);
  const body = Object.fromEntries(Object.entries(command.body).filter(([field]) => field !== "version"));
  const create = { ...body, id: itemId, description: body.description ?? null };
  const requiredFields = ["id", "name", "quantity", "status"];
  if (!requiredFields.every(field => Object.hasOwn(create, field))) {
    throw new Error(`Cannot rebase Item command ${command.commandId} without complete create Item state.`);
  }
  return create;
}

function mutableState(
  value: CachedOfflineItemState | AuthoritativeItemState | Record<string, unknown>,
): MutableItemState {
  return {
    name: value.name,
    description: value.description,
    quantity: value.quantity,
    status: value.status,
  };
}

function requestedPatch(command: OfflineItemCommand): Partial<MutableItemState> {
  if (!isObject(command.body))
    throw new Error(`Cannot rebase Item command ${command.commandId} with a non-object body.`);
  const patch: Partial<MutableItemState> = {};
  for (const field of MUTABLE_ITEM_FIELDS) {
    if (Object.hasOwn(command.body, field)) patch[field] = command.body[field];
  }
  if (Object.keys(patch).length === 0) {
    throw new Error(`Cannot rebase Item command ${command.commandId} without a mutable Item change.`);
  }
  return patch;
}

function unsatisfiedPatch(requested: Partial<MutableItemState>, current: MutableItemState): Partial<MutableItemState> {
  return Object.fromEntries(
    Object.entries(requested).filter(([field, value]) => !Object.is(current[field as MutableItemField], value)),
  );
}

function applyPatch(current: MutableItemState, patch: Partial<MutableItemState>): MutableItemState {
  return { ...current, ...patch };
}

/**
 * Replays local intent against one authoritative snapshot. Commands receive fresh
 * IDs and unique monotonic timestamps while preserving their capture order.
 */
export function rebaseOfflineItemCommands(
  commands: readonly OfflineItemCommand[],
  authoritativeItems: readonly AuthoritativeItemState[],
  cachedItems: readonly CachedOfflineItemState[] = [],
  newCommandId: () => string = () => crypto.randomUUID(),
): RebasedOfflineItemCommands {
  const revisions = new Map<string, ItemRevision>(
    authoritativeItems.map(item => [item.id, { exists: true, state: mutableState(item), version: item.version }]),
  );
  const cachedById = new Map(cachedItems.map(item => [item.id, item]));
  const rebased: OfflineItemCommand[] = [];
  const affectedItemIds = new Set<string>();
  const deletedItemIds: string[] = [];
  const coalescedMissingTargetIds = new Set<string>();
  const coalescedCreateCommandIds = new Map<string, string>();

  const orderedCommands = [...commands].sort(
    (left, right) => left.createdAt - right.createdAt || left.commandId.localeCompare(right.commandId),
  );
  const firstCreatedAt = orderedCommands[0]?.createdAt ?? 0;

  for (const [commandIndex, command] of orderedCommands.entries()) {
    const itemId = offlineItemIdFor(command);
    affectedItemIds.add(itemId);
    const revision = revisions.get(itemId) ?? { exists: false, state: null, version: 0 };
    let method: string;
    let url: string;
    let body: unknown;
    let coalescedMissingPatch = false;

    switch (command.method) {
      case "POST":
        if (revision.exists) {
          const create = createBodyFromCommand(command, itemId);
          const patch = unsatisfiedPatch(mutableState(create), revision.state!);
          if (Object.keys(patch).length === 0) continue;
          method = "PATCH";
          url = `/api/items/${itemId}`;
          body = { ...patch, version: revision.version };
          revision.state = applyPatch(revision.state!, patch);
          revision.version += 1;
        } else {
          method = "POST";
          url = "/api/items";
          const create = createBodyFromCommand(command, itemId);
          body = create;
          revision.exists = true;
          revision.state = mutableState(create);
          revision.version = 0;
        }
        break;
      case "PATCH":
        if (coalescedMissingTargetIds.has(itemId)) {
          // The one complete POST already represents the final cached local
          // state. Replaying another PATCH would need the hidden tombstone's
          // unknown version, so it is intentionally coalesced away.
          continue;
        }
        if (revision.exists) {
          const patch = unsatisfiedPatch(requestedPatch(command), revision.state!);
          if (Object.keys(patch).length === 0) continue;
          method = "PATCH";
          url = `/api/items/${itemId}`;
          body = { ...patch, version: revision.version };
          revision.state = applyPatch(revision.state!, patch);
          revision.version += 1;
        } else {
          method = "POST";
          url = "/api/items";
          const create = createBody(requireCompleteMutableState(command, itemId, cachedById));
          body = create;
          revision.exists = true;
          revision.state = mutableState(create);
          revision.version = 0;
          coalescedMissingTargetIds.add(itemId);
          coalescedMissingPatch = true;
        }
        break;
      case "DELETE":
        if (coalescedMissingTargetIds.delete(itemId)) {
          const coalescedCreateId = coalescedCreateCommandIds.get(itemId);
          if (coalescedCreateId) {
            const index = rebased.findIndex(candidate => candidate.commandId === coalescedCreateId);
            if (index >= 0) rebased.splice(index, 1);
          }
          deletedItemIds.push(itemId);
          revision.exists = false;
          revision.state = null;
          revision.version = 0;
          revisions.set(itemId, revision);
          continue;
        }
        if (!revision.exists) {
          deletedItemIds.push(itemId);
          continue;
        }
        method = "DELETE";
        url = `/api/items/${itemId}`;
        body = { version: revision.version };
        revision.exists = false;
        revision.state = null;
        revision.version = 0;
        break;
      default:
        throw new Error(`Cannot rebase unsupported offline Item method ${command.method}.`);
    }

    revisions.set(itemId, revision);
    const rebasedCommand = {
      ...command,
      body,
      commandId: newCommandId(),
      createdAt: firstCreatedAt + commandIndex,
      method,
      url,
    };
    rebased.push(rebasedCommand);
    if (coalescedMissingPatch) {
      coalescedCreateCommandIds.set(itemId, rebasedCommand.commandId);
    }
  }

  return {
    affectedItemIds: [...affectedItemIds],
    commands: rebased,
    deletedItemIds: [...new Set(deletedItemIds)],
  };
}
