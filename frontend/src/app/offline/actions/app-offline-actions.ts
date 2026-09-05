import type {
  AppCacheReadiness,
  AppOfflineSimulation,
  AppSyncSummary,
} from "@/app/offline/models/AppOffline";
import { ConnectivityStatus } from "@/app/offline/models/AppOffline";
import { sigCacheReadiness } from "@/app/offline/signals/sigCacheReadiness";
import { sigConnectivityStatus } from "@/app/offline/signals/sigConnectivityStatus";
import { sigOfflineSimulation } from "@/app/offline/signals/sigOfflineSimulation";
import { sigSyncSummary } from "@/app/offline/signals/sigSyncSummary";

export function setConnectivityStatus(status: ConnectivityStatus): void {
  sigConnectivityStatus.value = status;
}

export function patchSyncSummary(next: Partial<AppSyncSummary>): void {
  sigSyncSummary.value = { ...sigSyncSummary.value, ...next };
}

export function patchCacheReadiness(next: Partial<AppCacheReadiness>): void {
  sigCacheReadiness.value = { ...sigCacheReadiness.value, ...next };
}

export function patchOfflineSimulation(next: Partial<AppOfflineSimulation>): void {
  sigOfflineSimulation.value = { ...sigOfflineSimulation.value, ...next };
  if (next.enabled === true) setConnectivityStatus(ConnectivityStatus.OFFLINE);
}
