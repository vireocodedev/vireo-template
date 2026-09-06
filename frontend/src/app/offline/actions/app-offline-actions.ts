import {
  ConnectivityStatus,
  type AppCacheReadiness,
  type AppOfflineSimulation,
  type AppSyncSummary,
} from "../models/AppOffline";
import { sigCacheReadiness } from "../signals/sigCacheReadiness";
import { sigConnectivityStatus } from "../signals/sigConnectivityStatus";
import { sigOfflineSimulation } from "../signals/sigOfflineSimulation";
import { sigSyncSummary } from "../signals/sigSyncSummary";

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
