import { sigOfflineRecoveryInProgress } from "../signals/sigOfflineRecoveryInProgress";
import { withAppOfflineLock } from "./app-offline-lock";

type HydrateOfflineData = () => Promise<void>;
type OfflineRecoveryKind = "automatic" | "manual";

type AutomaticRecovery = {
  promise: Promise<void>;
  trailingHydrationRequested: boolean;
};

let activeHydration: Promise<void> | undefined;
let hydrationRequested = false;
let recoveryInProgress = false;
let recoveryBatchRequested = false;
let recoveryQueue: Promise<void> = Promise.resolve();
let pendingRecoveries = 0;
let activeAutomaticRecovery: AutomaticRecovery | undefined;

function runRequestedHydration(hydrate: HydrateOfflineData): Promise<void> {
  hydrationRequested = true;
  activeHydration ??= (async () => {
    while (hydrationRequested) {
      hydrationRequested = false;
      await hydrate();
    }
  })().finally(() => {
    activeHydration = undefined;
  });
  return activeHydration;
}

export function requestOfflineHydration(hydrate: HydrateOfflineData): Promise<void> {
  if (recoveryInProgress) {
    recoveryBatchRequested = true;
    return Promise.resolve();
  }
  return runRequestedHydration(hydrate);
}

async function runExclusiveOfflineRecovery(
  work: () => Promise<void>,
  hydrate: HydrateOfflineData,
  automaticRecovery?: AutomaticRecovery,
): Promise<void> {
  recoveryInProgress = true;
  recoveryBatchRequested = false;
  try {
    await activeHydration;
    await withAppOfflineLock(async () => {
      await work();
      // Events emitted by the completed work are included in the following snapshot.
      recoveryBatchRequested = false;
      await runRequestedHydration(hydrate);
      while (recoveryBatchRequested || automaticRecovery?.trailingHydrationRequested) {
        recoveryBatchRequested = false;
        if (automaticRecovery) automaticRecovery.trailingHydrationRequested = false;
        await runRequestedHydration(hydrate);
      }
    });
  } finally {
    recoveryInProgress = false;
    if (recoveryBatchRequested) {
      recoveryBatchRequested = false;
      await withAppOfflineLock(() => runRequestedHydration(hydrate));
    }
  }
}

export function runOfflineRecovery(
  work: () => Promise<void>,
  hydrate: HydrateOfflineData,
  kind: OfflineRecoveryKind = "automatic",
): Promise<void> {
  if (kind === "automatic" && activeAutomaticRecovery) {
    activeAutomaticRecovery.trailingHydrationRequested = true;
    return activeAutomaticRecovery.promise;
  }

  const automaticRecovery: AutomaticRecovery | undefined =
    kind === "automatic" ? { promise: Promise.resolve(), trailingHydrationRequested: false } : undefined;
  pendingRecoveries += 1;
  sigOfflineRecoveryInProgress.value = true;
  const recovery = recoveryQueue.then(() => runExclusiveOfflineRecovery(work, hydrate, automaticRecovery));
  recoveryQueue = recovery.catch(() => undefined);
  const trackedRecovery = recovery.finally(() => {
    pendingRecoveries -= 1;
    if (pendingRecoveries === 0) sigOfflineRecoveryInProgress.value = false;
    if (activeAutomaticRecovery === automaticRecovery) activeAutomaticRecovery = undefined;
  });
  if (automaticRecovery) {
    automaticRecovery.promise = trackedRecovery;
    activeAutomaticRecovery = automaticRecovery;
  }
  return trackedRecovery;
}
