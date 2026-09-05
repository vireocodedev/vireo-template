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
    const onlineDelete = vi.fn().mockResolvedValue(undefined);

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
    const create = vi.fn(async (value: Item) => value);
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
    const created = await api.create({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      version: 0,
      name: "Offline draft",
      description: "Created without the server",
      quantity: 2,
      status: "DRAFT",
    });

    const updated = await api.update(created.id, { ...created, name: "Offline update" });
    expect(updated.version).toBe(1);
    expect(await appOfflineQueue.getSize()).toBe(2);
    expect((await appOfflineItems.list()).find(item => item.id === updated.id)).toMatchObject({
      name: "Offline update",
      pending: true,
    });

    await api.delete(updated.id, updated.version);

    expect(await appOfflineQueue.getSize()).toBe(3);
    expect((await appOfflineItems.list()).find(item => item.id === updated.id)).toMatchObject({
      deleted: true,
      pending: true,
    });
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
        { method: "POST", url: "/api/items", body: { id, version: 0 } },
      );
    }

    await replayOfflineItems();

    expect(sentCommandIds).toHaveLength(2);
    expect(await appOfflineQueue.getSize()).toBe(2);
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

    await recoverOfflineItems();

    expect(request).toHaveBeenCalledOnce();
    expect(await appOfflineQueue.getSize()).toBe(0);
    expect((await appOfflineItems.list()).find(candidate => candidate.id === id)).toMatchObject({ pending: false });
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
      { method: "POST", url: "/api/items", body: { id, version: 0 } },
    );

    await replayOfflineItems();
    await retryOfflineChanges();

    expect(sentCommandIds).toHaveLength(2);
    expect(sentCommandIds[1]).not.toBe(sentCommandIds[0]);
    expect(await appOfflineQueue.getSize()).toBe(0);
  });

  it("rebases a stale PUT onto the authoritative Item version before retrying", async () => {
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
      { method: "PUT", url: `/api/items/${id}`, body: { id, version: 0, name: "Local wins" } },
    );
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.ONLINE);

    await replayOfflineItems();
    await retryOfflineChanges();

    expect(sent).toHaveLength(2);
    expect(sent[1]).toMatchObject({ method: "PUT", body: { id, version: 7 } });
    expect(sent[1]?.commandId).not.toBe(sent[0]?.commandId);
  });

  it("turns a conflicting POST into ordered PUT commands with successive versions", () => {
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
          body: { id, version: 0, name: "First local value" },
        },
        {
          commandId: "original-update",
          createdAt: 10,
          headers: {},
          method: "PUT",
          url: `/api/items/${id}`,
          body: { id, version: 0, name: "Second local value" },
        },
      ],
      [{ id, version: 4 }],
      () => `rebased-${++nextId}`,
    );

    expect(rebased.commands).toEqual([
      expect.objectContaining({
        commandId: "rebased-1",
        createdAt: 10,
        method: "PUT",
        url: `/api/items/${id}`,
        body: { id, version: 4, name: "First local value" },
      }),
      expect.objectContaining({
        commandId: "rebased-2",
        createdAt: 11,
        method: "PUT",
        url: `/api/items/${id}`,
        body: { id, version: 5, name: "Second local value" },
      }),
    ]);
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
      { method: "POST", url: "/api/items", body: { id, version: 0, name: "Eventually retry" } },
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
      { method: "POST", url: "/api/items", body: { id, version: 0 } },
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
      { method: "POST", url: "/api/items", body: { id, version: 0 } },
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
