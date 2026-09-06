import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installMockAppAdapters } from "@/app/adapters/mock/app.mock-adapters";
import {
  configureOfflineShowcaseTransport,
  hydrateOfflineItems,
  initializeOfflineData,
  replayOfflineItems,
} from "@/app/adapters/app-offline.adapter";
import { appAuthApi } from "@/app/data/network/api/app-auth.api.online";
import { patchOfflineSimulation, setConnectivityStatus } from "@/app/offline/actions/app-offline-actions";
import { ConnectivityStatus } from "@/app/offline/models/AppOffline";
import { recordAppHeartbeat } from "@/app/offline/services/app-offline-heartbeat";
import { appOfflineQueue, appOfflineRuntime } from "@/app/offline/sqlite/app-offline-sqlite";
import { configureItemApi, itemApi, ItemApiOnline } from "@/features/item/api/item.api.online";

describe("mock offline showcase transport", () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    appOfflineRuntime.reset();
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    installMockAppAdapters();
    await appAuthApi.login("demo", "demo123");
    await initializeOfflineData();
    recordAppHeartbeat();
  });

  afterEach(() => {
    configureOfflineShowcaseTransport(undefined);
    configureItemApi(new ItemApiOnline());
    vi.restoreAllMocks();
  });

  it("replays and hydrates queued Item work through mock transport without HTTP", async () => {
    const http = vi.spyOn(globalThis, "fetch");
    patchOfflineSimulation({ enabled: true });
    setConnectivityStatus(ConnectivityStatus.OFFLINE);
    const item = await itemApi.create({
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      version: 0,
      name: "Queued mock item",
      description: "",
      quantity: 1,
      status: "DRAFT",
    });
    expect(await appOfflineQueue.getSize()).toBe(1);

    patchOfflineSimulation({ enabled: false });
    recordAppHeartbeat();
    await replayOfflineItems();
    await hydrateOfflineItems();

    const page = await itemApi.search(
      { page: 0, rowsPerPage: 10, sortBy: "name", sortDirection: "asc" },
      { searchText: "Queued mock item", queryFilters: null },
    );
    expect(page.content).toContainEqual(expect.objectContaining({ id: item.value.id }));
    expect(await appOfflineQueue.getSize()).toBe(0);
    expect(http).not.toHaveBeenCalled();
  });

  it("restores mock authentication and Item data from tab storage", async () => {
    const first = await itemApi.create({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      version: 0,
      name: "Persisted mock item",
      description: "",
      quantity: 1,
      status: "ACTIVE",
    });

    installMockAppAdapters();

    await expect(appAuthApi.me()).resolves.toEqual({ username: "demo", role: "SUPERADMIN" });
    const page = await itemApi.search(
      { page: 0, rowsPerPage: 10, sortBy: "name", sortDirection: "asc" },
      { searchText: first.value.name, queryFilters: null },
    );
    expect(page.content).toEqual(expect.arrayContaining([expect.objectContaining({ id: first.value.id })]));
  });
});
