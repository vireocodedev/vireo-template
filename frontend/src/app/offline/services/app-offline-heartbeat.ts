import { setConnectivityStatus } from "@/app/offline/actions/app-offline-actions";
import { sigOfflineSimulation } from "@/app/offline/signals/sigOfflineSimulation";
import { ConnectivityStatus } from "@/app/offline/models/AppOffline";

let lastHeartbeatAt = 0;

export function recordAppHeartbeat(receivedAt = Date.now()): void {
  lastHeartbeatAt = receivedAt;
  if (!sigOfflineSimulation.value.enabled) setConnectivityStatus(ConnectivityStatus.ONLINE);
}

export function expireAppHeartbeat(now = Date.now(), maxAgeMs = 12_000): void {
  if (sigOfflineSimulation.value.enabled || lastHeartbeatAt === 0 || now - lastHeartbeatAt > maxAgeMs) {
    setConnectivityStatus(ConnectivityStatus.OFFLINE);
  }
}

export function resetAppHeartbeat(): void {
  lastHeartbeatAt = 0;
  setConnectivityStatus(ConnectivityStatus.OFFLINE);
}
