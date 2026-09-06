import axios from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ItemApiOfflineCapable,
  applyQueuedItemMutation,
  configureOfflineShowcaseTransport,
  discardOfflineChanges,
  hydrateOfflineItems,
  initializeOfflineData,
  purgeOfflineData,
  recoverOfflineItems,
  replayOfflineItems,
  resetOfflineCache,
  retryOfflineChanges,
  validateOfflineCurrentUser,
  validateLiveOfflineCurrentUser,
} from "@/app/adapters/app-offline.adapter";
import {
  patchCacheReadiness,
  patchOfflineSimulation,
  setConnectivityStatus,
} from "@/app/offline/actions/app-offline-actions";
import { CacheStatus, ConnectivityStatus } from "@/app/offline/models/AppOffline";
import { rebaseOfflineItemCommands } from "@/app/offline/services/app-offline-rebase";
import { sigCacheReadiness } from "@/app/offline/signals/sigCacheReadiness";
import { sigConnectivityStatus } from "@/app/offline/signals/sigConnectivityStatus";
import { sigOfflineSimulation } from "@/app/offline/signals/sigOfflineSimulation";
import { sigSyncSummary } from "@/app/offline/signals/sigSyncSummary";
import { appAxios } from "@/app/data/network/clients/AppAxiosClient";
import { appOfflineItems, appOfflineQueue, appOfflineRuntime } from "@/app/offline/sqlite/app-offline-sqlite";
import type { Item, ItemApi } from "@/features/item/public";

const originalAxiosAdapter = appAxios.defaults.adapter;

const unreachableApi: ItemApi = {
  search: async () => {
    throw new Error("Online API must not be used while simulated offline.");
  },
  create: async () => {
    throw new Error("Online API must not be used while simulated offline.");
  },
  update: async () => {
    throw new Error("Online API must not be used while simulated offline.");
  },
  delete: async () => {
    throw new Error("Online API must not be used while simulated offline.");
  },
};

describe("offline Item data", () => {
  beforeEach(async () => {
    configureOfflineShowcaseTransport(undefined);
    appOfflineRuntime.reset();
    appOfflineRuntime.clearInMemoryStores();
    localStorage.clear();
    patchCacheReadiness({ error: null, status: CacheStatus.UNAVAILABLE });
    patchOfflineSimulation({ enabled: true, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.OFFLINE);
    await initializeOfflineData();
  });

  afterEach(() => {
    appAxios.defaults.adapter = originalAxiosAdapter;
    configureOfflineShowcaseTransport(undefined);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not start the OPFS Worker when the document is not cross-origin isolated", async () => {
    vi.stubGlobal("Worker", class Worker {});
    vi.stubGlobal("crossOriginIsolated", false);
    vi.stubGlobal("SharedArrayBuffer", undefined);
    const warmup = vi.spyOn(appOfflineRuntime, "warmup").mockRejectedValue(new Error("OPFS unavailable"));

    patchOfflineSimulation({ enabled: true, failNextReplay: false });
    await initializeOfflineData();

    expect(warmup).not.toHaveBeenCalled();
    expect(sigCacheReadiness.value.status).toBe(CacheStatus.UNAVAILABLE);
    expect(sigOfflineSimulation.value.enabled).toBe(false);
  });

  it("keeps online deletes and every offline maintenance path out of SQLite when OPFS is unavailable", async () => {
    vi.stubGlobal("Worker", class Worker {});
    vi.stubGlobal("crossOriginIsolated", false);
    vi.stubGlobal("SharedArrayBuffer", undefined);
    const warmup = vi.spyOn(appOfflineRuntime, "warmup").mockRejectedValue(new Error("OPFS unavailable"));
    const list = vi.spyOn(appOfflineItems, "list");
    const onlineDelete = vi.fn().mockResolvedValue({ persistence: "SAVED" as const, value: undefined });

    patchOfflineSimulation({ enabled: true, failNextReplay: false });
    await initializeOfflineData();
    setConnectivityStatus(ConnectivityStatus.ONLINE);

    await new ItemApiOfflineCapable({ ...unreachableApi, delete: onlineDelete }).delete(
      "00000000-0000-4000-8000-000000000500",
      0,
    );
    await hydrateOfflineItems();
    await purgeOfflineData();
    await resetOfflineCache();

    expect(onlineDelete).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000500", 0);
    expect(list).not.toHaveBeenCalled();
    expect(warmup).not.toHaveBeenCalled();
    expect(sigCacheReadiness.value.status).toBe(CacheStatus.UNAVAILABLE);
  });

  it("routes mutations from the connectivity signal rather than the simulator flag", async () => {
    const create = vi.fn(async (value: Item) => ({ persistence: "SAVED" as const, value }));
    patchOfflineSimulation({ enabled: true, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);

    await new ItemApiOfflineCapable({ ...unreachableApi, create }).create({
      id: "00000000-0000-4000-8000-000000000511",
      version: 0,
      name: "Signal-routed Item",
      description: "",
      quantity: 1,
      status: "DRAFT",
    });

    expect(create).toHaveBeenCalledOnce();
    expect(await appOfflineQueue.getSize()).toBe(0);
  });

  it("queues an eligible network failure without changing the heartbeat signal", async () => {
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);
    const create = vi.fn(async () => {
      throw new axios.AxiosError("Connection lost", "ERR_NETWORK");
    });

    await new ItemApiOfflineCapable({ ...unreachableApi, create }).create({
      id: "00000000-0000-4000-8000-000000000512",
      version: 0,
      name: "Queued after network failure",
      description: "",
      quantity: 1,
      status: "DRAFT",
    });

    expect(await appOfflineQueue.getSize()).toBe(1);
    expect(sigConnectivityStatus.value).toBe(ConnectivityStatus.ONLINE);
  });

  it("queues create, update, and delete while preserving an optimistic local view", async () => {
    const api = new ItemApiOfflineCapable(unreachableApi);
    const createdResult = await api.create({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      version: 0,
      name: "Offline draft",
      description: "Created without the server",
      quantity: 2,
      status: "DRAFT",
    });
    expect(createdResult.persistence).toBe("QUEUED");
    const created = createdResult.value;

    const updatedResult = await api.update(created.id, { ...created, name: "Offline update" });
    expect(updatedResult.persistence).toBe("QUEUED");
    const updated = updatedResult.value;
    expect(updated.version).toBe(1);
    expect(await appOfflineQueue.getSize()).toBe(2);
    expect((await appOfflineItems.list()).find(item => item.id === updated.id)).toMatchObject({
      name: "Offline update",
      pending: true,
    });

    const deleted = await api.delete(updated.id, updated.version);
    expect(deleted.persistence).toBe("QUEUED");

    expect(await appOfflineQueue.getSize()).toBe(3);
    expect((await appOfflineItems.list()).find(item => item.id === updated.id)).toMatchObject({
      deleted: true,
      pending: true,
    });
  });

  it("does not queue or advance a no-op update before queuing the next real PATCH", async () => {
    const api = new ItemApiOfflineCapable(unreachableApi);
    const current: Item = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      version: 0,
      name: "No-op proof",
      description: "",
      quantity: 2,
      status: "DRAFT",
    };
    await appOfflineItems.upsert({ ...current, pending: false, conflict: false, deleted: false });

    const noOp = await api.update(current.id, current);
    const updated = await api.update(current.id, { ...current, name: "Real queued change" });
    const commands = await appOfflineQueue.getBatch(10);

    expect(noOp).toEqual({ persistence: "SAVED", value: current });
    expect(updated.value.version).toBe(1);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      method: "PATCH",
      url: `/api/items/${current.id}`,
      body: { version: 0, name: "Real queued change" },
    });
  });

  it.each([
    ["pending", true, false],
    ["conflicted", false, true],
  ])("does not report a %s cached update as saved or enqueue a no-op", async (_state, pending, conflict) => {
    const current: Item = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab",
      version: 0,
      name: "Unresolved local state",
      description: "",
      quantity: 2,
      status: "DRAFT",
    };
    await appOfflineItems.upsert({ ...current, pending, conflict, deleted: false });

    const result = await new ItemApiOfflineCapable(unreachableApi).update(current.id, current);

    expect(result.persistence).toBe("QUEUED");
    expect(result.value.version).toBe(0);
    expect(await appOfflineQueue.getSize()).toBe(0);
  });

  it("replays one command at a time and stops at the first permanent result", async () => {
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);
    const sentCommandIds: string[] = [];
    let replayCount = 0;
    appAxios.defaults.adapter = async config => {
      if (config.url === "/app/current-user") {
        return {
          config,
          data: { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", username: "admin", role: "SUPERADMIN" },
          headers: {},
          status: 200,
          statusText: "OK",
        };
      }
      if (config.url === "/offline/sync") {
        const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;
        expect(body.commands).toHaveLength(1);
        sentCommandIds.push(body.commands[0].commandId);
        replayCount += 1;
        return {
          config,
          data: {
            results: [
              {
                commandId: body.commands[0].commandId,
                success: replayCount !== 2,
                status: replayCount === 2 ? 409 : 200,
                error: replayCount === 2 ? "Conflict" : null,
                reason: replayCount === 2 ? "REJECTED" : "APPLIED",
              },
            ],
          },
          headers: {},
          status: 200,
          statusText: "OK",
        };
      }
      throw new Error(`Unexpected request ${config.url}`);
    };

    for (const id of [
      "00000000-0000-4000-8000-000000000501",
      "00000000-0000-4000-8000-000000000502",
      "00000000-0000-4000-8000-000000000503",
    ]) {
      await applyQueuedItemMutation(
        {
          id,
          version: 0,
          name: id,
          description: "",
          quantity: 1,
          status: "DRAFT",
          pending: true,
          conflict: false,
          deleted: false,
        },
        id,
        { method: "POST", url: "/api/items", body: { id, name: id, description: "", quantity: 1, status: "DRAFT" } },
      );
    }

    const previousSequence = sigSyncSummary.value.synchronizationSequence;
    await replayOfflineItems();

    expect(sentCommandIds).toHaveLength(2);
    expect(await appOfflineQueue.getSize()).toBe(2);
    expect(sigSyncSummary.value.synchronizationSequence).toBe(previousSequence);
  });

  it("restores a rejected queued deletion as a visible conflict", async () => {
    const id = "00000000-0000-4000-8000-000000000521";
    const item: Item = {
      id,
      version: 2,
      name: "Server changed deletion",
      description: "",
      quantity: 1,
      status: "ACTIVE",
    };
    await appOfflineItems.upsert({ ...item, pending: false, conflict: false, deleted: false });
    const api = new ItemApiOfflineCapable(unreachableApi);
    await api.delete(id, item.version);
    configureOfflineShowcaseTransport({
      currentUser: async () => ({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        username: "admin",
        role: "SUPERADMIN",
        validatedAt: Date.now(),
      }),
      replay: async commands => ({
        results: commands.map(command => ({
          commandId: command.commandId,
          success: false,
          status: 409,
          error: "The Item has changed on the server.",
          reason: "REJECTED" as const,
        })),
      }),
      searchItems: async () => ({ content: [item], number: 0, size: 100, totalElements: 1, totalPages: 1 }),
    });
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);

    await replayOfflineItems();

    expect((await appOfflineItems.list()).find(candidate => candidate.id === id)).toMatchObject({
      conflict: true,
      deleted: false,
      pending: false,
    });
    await expect(
      api.search(
        { page: 0, rowsPerPage: 10, sortBy: "name", sortDirection: "asc" },
        { searchText: item.name, queryFilters: null },
      ),
    ).resolves.toMatchObject({ content: [expect.objectContaining({ id, name: item.name })] });
  });

  it("recovers the owner, queued commands, and authoritative snapshot under one lock", async () => {
    const id = "00000000-0000-4000-8000-000000000520";
    const item: Item = {
      id,
      version: 0,
      name: "Atomic recovery",
      description: "",
      quantity: 1,
      status: "DRAFT",
    };
    await applyQueuedItemMutation({ ...item, pending: true, conflict: false, deleted: false }, id, {
      method: "POST",
      url: "/api/items",
      body: item,
    });
    configureOfflineShowcaseTransport({
      currentUser: async () => ({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        username: "admin",
        role: "SUPERADMIN",
        validatedAt: Date.now(),
      }),
      replay: async commands => ({
        results: commands.map(command => ({
          commandId: command.commandId,
          success: true,
          status: 201,
          error: null,
          reason: "APPLIED" as const,
        })),
      }),
      searchItems: async () => ({ content: [item], number: 0, size: 100, totalElements: 1, totalPages: 1 }),
    });
    const request = vi.fn(async (_name: string, operation: () => Promise<void>) => operation());
    vi.stubGlobal("navigator", { locks: { request } });
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);

    const previousSequence = sigSyncSummary.value.synchronizationSequence;
    await recoverOfflineItems();

    expect(request).toHaveBeenCalledOnce();
    expect(await appOfflineQueue.getSize()).toBe(0);
    expect((await appOfflineItems.list()).find(candidate => candidate.id === id)).toMatchObject({ pending: false });
    expect(sigSyncSummary.value).toMatchObject({
      lastSynchronizedCount: 1,
      synchronizationSequence: previousSequence + 1,
    });
  });

  it("reissues a failed command with a fresh command ID before replaying it", async () => {
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);
    const sentCommandIds: string[] = [];
    let replayCount = 0;
    configureOfflineShowcaseTransport({
      currentUser: async () => ({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        username: "admin",
        role: "SUPERADMIN",
        validatedAt: Date.now(),
      }),
      searchItems: async () => ({ content: [], number: 0, size: 100, totalElements: 0, totalPages: 0 }),
      replay: async commands => {
        const command = commands[0];
        if (!command) throw new Error("Expected one command.");
        sentCommandIds.push(command.commandId);
        replayCount += 1;
        return {
          results: [
            {
              commandId: command.commandId,
              success: replayCount > 1,
              status: replayCount > 1 ? 200 : 409,
              error: replayCount > 1 ? null : "Conflict",
              reason: replayCount > 1 ? "APPLIED" : "REJECTED",
            },
          ],
        };
      },
    });
    const id = "00000000-0000-4000-8000-000000000506";
    await applyQueuedItemMutation(
      {
        id,
        version: 0,
        name: "Retry me",
        description: "",
        quantity: 1,
        status: "DRAFT",
        pending: true,
        conflict: false,
        deleted: false,
      },
      id,
      {
        method: "POST",
        url: "/api/items",
        body: { id, name: "Retry me", description: "", quantity: 1, status: "DRAFT" },
      },
    );

    await replayOfflineItems();
    await retryOfflineChanges();

    expect(sentCommandIds).toHaveLength(2);
    expect(sentCommandIds[1]).not.toBe(sentCommandIds[0]);
    expect(await appOfflineQueue.getSize()).toBe(0);
  });

  it("rebases a stale PATCH onto the authoritative Item version before retrying", async () => {
    const id = "00000000-0000-4000-8000-000000000507";
    const sent: Array<{ body: Record<string, unknown>; commandId: string; method: string }> = [];
    let replayCount = 0;
    configureOfflineShowcaseTransport({
      currentUser: async () => ({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        username: "admin",
        role: "SUPERADMIN",
        validatedAt: Date.now(),
      }),
      searchItems: async () => ({
        content: [{ id, version: 7, name: "Server Item", description: "", quantity: 1, status: "ACTIVE" as const }],
        number: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      }),
      replay: async commands => {
        const command = commands[0];
        if (!command || typeof command.body !== "object" || command.body === null)
          throw new Error("Expected an Item command.");
        replayCount += 1;
        sent.push({
          body: command.body as Record<string, unknown>,
          commandId: command.commandId,
          method: command.method,
        });
        return {
          results: [
            {
              commandId: command.commandId,
              success: replayCount > 1,
              status: replayCount > 1 ? 200 : 409,
              error: replayCount > 1 ? null : "Conflict",
              reason: replayCount > 1 ? "APPLIED" : "REJECTED",
            },
          ],
        };
      },
    });
    await applyQueuedItemMutation(
      {
        id,
        version: 1,
        name: "Local wins",
        description: "",
        quantity: 2,
        status: "ACTIVE",
        pending: true,
        conflict: false,
        deleted: false,
      },
      id,
      {
        method: "PATCH",
        url: `/api/items/${id}`,
        body: { version: 0, name: "Local wins", description: "", quantity: 2, status: "ACTIVE" },
      },
    );
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);

    await replayOfflineItems();
    await retryOfflineChanges();

    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ method: "PATCH", body: { version: 7, name: "Local wins" } });
    expect(sent[1]?.commandId).not.toBe(sent[0]?.commandId);
  });

  it("resolves an already-applied nullable PATCH without leaving stale cache flags", async () => {
    const id = "00000000-0000-4000-8000-000000000514";
    const replay = vi.fn(async commands => ({
      results: [
        {
          commandId: commands[0]?.commandId,
          success: false,
          status: 409,
          error: "Conflict",
          reason: "REJECTED",
        },
      ],
    }));
    configureOfflineShowcaseTransport({
      currentUser: async () => ({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        username: "admin",
        role: "SUPERADMIN",
        validatedAt: Date.now(),
      }),
      searchItems: async () => ({
        content: [{ id, version: 7, name: "Already applied", description: null, quantity: 1, status: "ACTIVE" }],
        number: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      }),
      replay,
    });
    await applyQueuedItemMutation(
      {
        id,
        version: 1,
        name: "Already applied",
        description: "",
        quantity: 1,
        status: "ACTIVE",
        pending: true,
        conflict: false,
        deleted: false,
      },
      id,
      { method: "PATCH", url: `/api/items/${id}`, body: { version: 0, description: null } },
    );
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);

    await replayOfflineItems();
    await retryOfflineChanges();

    expect(replay).toHaveBeenCalledOnce();
    expect(await appOfflineQueue.getSize()).toBe(0);
    expect((await appOfflineItems.list()).find(item => item.id === id)).toMatchObject({
      version: 7,
      description: "",
      pending: false,
      conflict: false,
    });
  });

  it("turns a conflicting POST into ordered PATCH commands with successive versions", () => {
    const id = "00000000-0000-4000-8000-000000000509";
    let nextId = 0;
    const rebased = rebaseOfflineItemCommands(
      [
        {
          commandId: "original-create",
          createdAt: 10,
          headers: {},
          method: "POST",
          url: "/api/items",
          body: { id, name: "First local value", description: "", quantity: 1, status: "DRAFT" },
        },
        {
          commandId: "original-update",
          createdAt: 10,
          headers: {},
          method: "PATCH",
          url: `/api/items/${id}`,
          body: { version: 0, name: "Second local value", description: "", quantity: 2, status: "ACTIVE" },
        },
      ],
      [{ id, version: 4, name: "Server value", description: "Server description", quantity: 0, status: "ARCHIVED" }],
      [
        {
          id,
          version: 1,
          name: "Second local value",
          description: "",
          quantity: 2,
          status: "ACTIVE",
        },
      ],
      () => `rebased-${++nextId}`,
    );

    expect(rebased.commands).toEqual([
      expect.objectContaining({
        commandId: "rebased-1",
        createdAt: 10,
        method: "PATCH",
        url: `/api/items/${id}`,
        body: { version: 4, name: "First local value", description: "", quantity: 1, status: "DRAFT" },
      }),
      expect.objectContaining({
        commandId: "rebased-2",
        createdAt: 11,
        method: "PATCH",
        url: `/api/items/${id}`,
        body: { version: 5, name: "Second local value", quantity: 2, status: "ACTIVE" },
      }),
    ]);
  });

  it("rebases an existing Item PATCH without inventing omitted mutable fields", () => {
    const id = "00000000-0000-4000-8000-000000000510";
    const rebased = rebaseOfflineItemCommands(
      [
        {
          commandId: "partial-patch",
          createdAt: 10,
          headers: {},
          method: "PATCH",
          url: `/api/items/${id}`,
          body: { version: 0, name: "Only this value changes" },
        },
      ],
      [{ id, version: 7, name: "Server value", description: "", quantity: 1, status: "DRAFT" }],
      [],
      () => "rebased-partial",
    );

    expect(rebased.commands).toEqual([
      expect.objectContaining({
        commandId: "rebased-partial",
        method: "PATCH",
        url: `/api/items/${id}`,
        body: { version: 7, name: "Only this value changes" },
      }),
    ]);
  });

  it("omits an already-satisfied PATCH without inventing a server version for the next PATCH", () => {
    const id = "00000000-0000-4000-8000-000000000513";
    let nextId = 0;
    const rebased = rebaseOfflineItemCommands(
      [
        {
          commandId: "already-satisfied",
          createdAt: 10,
          headers: {},
          method: "PATCH",
          url: `/api/items/${id}`,
          body: { version: 2, name: "Already on server" },
        },
        {
          commandId: "real-change",
          createdAt: 11,
          headers: {},
          method: "PATCH",
          url: `/api/items/${id}`,
          body: { version: 3, quantity: 9 },
        },
      ],
      [{ id, version: 7, name: "Already on server", description: "", quantity: 1, status: "ACTIVE" }],
      [],
      () => `rebased-${++nextId}`,
    );

    expect(rebased.commands).toEqual([
      expect.objectContaining({
        commandId: "rebased-1",
        method: "PATCH",
        url: `/api/items/${id}`,
        body: { version: 7, quantity: 9 },
      }),
    ]);
  });

  it("coalesces multiple PATCHes for a deleted server Item into one complete restore create", () => {
    const id = "00000000-0000-4000-8000-000000000511";
    const rebased = rebaseOfflineItemCommands(
      [
        {
          commandId: "first-patch",
          createdAt: 10,
          headers: {},
          method: "PATCH",
          url: `/api/items/${id}`,
          body: { version: 3, name: "First local name" },
        },
        {
          commandId: "second-patch",
          createdAt: 11,
          headers: {},
          method: "PATCH",
          url: `/api/items/${id}`,
          body: { version: 4, quantity: 9 },
        },
      ],
      [],
      [
        {
          id,
          version: 5,
          name: "First local name",
          description: "Final cached state",
          quantity: 9,
          status: "ACTIVE",
        },
      ],
      () => "rebased-restore",
    );

    expect(rebased.commands).toEqual([
      expect.objectContaining({
        commandId: "rebased-restore",
        method: "POST",
        url: "/api/items",
        body: {
          id,
          name: "First local name",
          description: "Final cached state",
          quantity: 9,
          status: "ACTIVE",
        },
      }),
    ]);
  });

  it("normalizes an omitted create description to its explicit nullable value", () => {
    const id = "00000000-0000-4000-8000-000000000512";
    const rebased = rebaseOfflineItemCommands(
      [
        {
          commandId: "create-without-description",
          createdAt: 10,
          headers: {},
          method: "POST",
          url: "/api/items",
          body: { id, name: "Nullable description", quantity: 1, status: "DRAFT" },
        },
      ],
      [],
      [],
      () => "rebased-create",
    );

    expect(rebased.commands[0]?.body).toEqual({
      id,
      name: "Nullable description",
      description: null,
      quantity: 1,
      status: "DRAFT",
    });
  });

  it("makes a transiently exhausted command available to the local-wins retry", async () => {
    const id = "00000000-0000-4000-8000-000000000508";
    const sentCommandIds: string[] = [];
    let shouldSucceed = false;
    configureOfflineShowcaseTransport({
      currentUser: async () => ({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        username: "admin",
        role: "SUPERADMIN",
        validatedAt: Date.now(),
      }),
      searchItems: async () => ({ content: [], number: 0, size: 100, totalElements: 0, totalPages: 0 }),
      replay: async commands => {
        const command = commands[0];
        if (!command) throw new Error("Expected one command.");
        sentCommandIds.push(command.commandId);
        if (!shouldSucceed) throw new axios.AxiosError("Temporary outage", "ERR_NETWORK");
        return {
          results: [{ commandId: command.commandId, success: true, status: 200, error: null, reason: "APPLIED" }],
        };
      },
    });
    await applyQueuedItemMutation(
      {
        id,
        version: 0,
        name: "Eventually retry",
        description: "",
        quantity: 1,
        status: "DRAFT",
        pending: true,
        conflict: false,
        deleted: false,
      },
      id,
      {
        method: "POST",
        url: "/api/items",
        body: { id, name: "Eventually retry", description: "", quantity: 1, status: "DRAFT" },
      },
    );
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);
    vi.useFakeTimers();
    try {
      const replay = replayOfflineItems();
      await vi.advanceTimersByTimeAsync(31_000);
      await replay;

      shouldSucceed = true;
      await retryOfflineChanges();
    } finally {
      vi.useRealTimers();
    }

    expect(sentCommandIds).toHaveLength(6);
    expect(sentCommandIds[5]).not.toBe(sentCommandIds[0]);
    expect(await appOfflineQueue.getSize()).toBe(0);
  });

  it("discards queued changes and their pending/conflict local rows together", async () => {
    const id = "00000000-0000-4000-8000-000000000504";
    await applyQueuedItemMutation(
      {
        id,
        version: 0,
        name: "Discard me",
        description: "",
        quantity: 1,
        status: "DRAFT",
        pending: true,
        conflict: true,
        deleted: false,
      },
      id,
      {
        method: "POST",
        url: "/api/items",
        body: { id, name: "Discard me", description: "", quantity: 1, status: "DRAFT" },
      },
    );

    await discardOfflineChanges();

    expect(await appOfflineQueue.getSize()).toBe(0);
    expect(await appOfflineItems.list()).toEqual([]);
  });

  it("finishes an owner switch purge before returning the validated identity", async () => {
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);
    const id = "00000000-0000-4000-8000-000000000505";
    configureOfflineShowcaseTransport({
      currentUser: async () => ({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        username: "first",
        role: "SUPERADMIN",
        validatedAt: Date.now(),
      }),
      searchItems: async () => ({ content: [], number: 0, size: 100, totalElements: 0, totalPages: 0 }),
      replay: async () => ({ results: [] }),
    });
    await validateOfflineCurrentUser();
    await applyQueuedItemMutation(
      {
        id,
        version: 0,
        name: "Old owner",
        description: "",
        quantity: 1,
        status: "DRAFT",
        pending: true,
        conflict: false,
        deleted: false,
      },
      id,
      {
        method: "POST",
        url: "/api/items",
        body: { id, name: "Old owner", description: "", quantity: 1, status: "DRAFT" },
      },
    );
    configureOfflineShowcaseTransport({
      currentUser: async () => ({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        username: "next",
        role: "SUPERADMIN",
        validatedAt: Date.now(),
      }),
      searchItems: async () => ({ content: [], number: 0, size: 100, totalElements: 0, totalPages: 0 }),
      replay: async () => ({ results: [] }),
    });

    await expect(validateOfflineCurrentUser()).resolves.toMatchObject({ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" });

    expect(await appOfflineQueue.getSize()).toBe(0);
  });

  it("does not use a cached identity when the live identity endpoint is unavailable", async () => {
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);
    localStorage.setItem(
      "starter-template:offline-current-user",
      JSON.stringify({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        username: "stale-owner",
        role: "SUPERADMIN",
        validatedAt: Date.now(),
      }),
    );
    appAxios.defaults.adapter = async config => {
      throw new axios.AxiosError("Service unavailable", "ERR_BAD_RESPONSE", config, undefined, {
        config,
        data: null,
        headers: {},
        status: 503,
        statusText: "Service unavailable",
      });
    };

    await expect(validateOfflineCurrentUser()).rejects.toBeInstanceOf(axios.AxiosError);
  });

  it("can force live owner validation before the first heartbeat", async () => {
    setConnectivityStatus(ConnectivityStatus.OFFLINE);
    localStorage.setItem(
      "starter-template:offline-current-user",
      JSON.stringify({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        username: "stale-owner",
        role: "SUPERADMIN",
        validatedAt: Date.now(),
      }),
    );
    configureOfflineShowcaseTransport({
      currentUser: async () => ({
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        username: "live-owner",
        role: "USER",
        validatedAt: Date.now(),
      }),
      searchItems: async () => ({ content: [], number: 0, size: 100, totalElements: 0, totalPages: 0 }),
      replay: async () => ({ results: [] }),
    });

    await expect(validateLiveOfflineCurrentUser()).resolves.toMatchObject({ username: "live-owner" });
  });
});
