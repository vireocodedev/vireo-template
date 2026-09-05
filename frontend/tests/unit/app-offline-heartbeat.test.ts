import { beforeEach, describe, expect, it } from "vitest";
import { patchOfflineSimulation, setConnectivityStatus } from "@/app/offline/actions/app-offline-actions";
import {
  expireAppHeartbeat,
  recordAppHeartbeat,
  resetAppHeartbeat,
} from "@/app/offline/services/app-offline-heartbeat";
import { sigConnectivityStatus } from "@/app/offline/signals/sigConnectivityStatus";
import { ConnectivityStatus } from "@/app/offline/models/AppOffline";

describe("offline heartbeat", () => {
  beforeEach(() => {
    patchOfflineSimulation({ enabled: false, failNextReplay: false });
    setConnectivityStatus(ConnectivityStatus.OFFLINE);
  });

  it("only considers a recent validated heartbeat online", () => {
    recordAppHeartbeat(10_000);
    expect(sigConnectivityStatus.value).toBe(ConnectivityStatus.ONLINE);

    expireAppHeartbeat(22_001);
    expect(sigConnectivityStatus.value).toBe(ConnectivityStatus.OFFLINE);
  });

  it("does not let a heartbeat bypass the tab-local offline simulator", () => {
    patchOfflineSimulation({ enabled: true });
    recordAppHeartbeat(10_000);

    expect(sigConnectivityStatus.value).toBe(ConnectivityStatus.OFFLINE);
  });

  it("lets simulation force offline immediately but not declare the app online", () => {
    recordAppHeartbeat(10_000);
    expect(sigConnectivityStatus.value).toBe(ConnectivityStatus.ONLINE);

    patchOfflineSimulation({ enabled: true });
    expect(sigConnectivityStatus.value).toBe(ConnectivityStatus.OFFLINE);

    patchOfflineSimulation({ enabled: false });
    expect(sigConnectivityStatus.value).toBe(ConnectivityStatus.OFFLINE);

    recordAppHeartbeat(10_001);
    expect(sigConnectivityStatus.value).toBe(ConnectivityStatus.ONLINE);
  });

  it("forgets heartbeat state at an authentication boundary", () => {
    recordAppHeartbeat(10_000);

    resetAppHeartbeat();
    expireAppHeartbeat(10_001);

    expect(sigConnectivityStatus.value).toBe(ConnectivityStatus.OFFLINE);
  });
});
