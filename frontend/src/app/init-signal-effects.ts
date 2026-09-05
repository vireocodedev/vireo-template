import { effect } from "@preact/signals-react";
import { patchOfflineSimulation } from "@/app/offline/actions/app-offline-actions";
import { expireAppHeartbeat } from "@/app/offline/services/app-offline-heartbeat";
import { sigConnectivityStatus } from "@/app/offline/signals/sigConnectivityStatus";
import { sigOfflineSimulation } from "@/app/offline/signals/sigOfflineSimulation";
import { sigSyncSummary } from "@/app/offline/signals/sigSyncSummary";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import { ConnectivityStatus } from "@/app/offline/models/AppOffline";
import { createAppPreferencesStorage } from "@/app/ui/preferences/services/app-preferences-storage";
import { toast } from "@vireocodedev/ui/sonner";
import { appI18n } from "@/app/ui/localization/app-i18n";
import { ITEM_TRANSLATION_NAMESPACE } from "@/app/app.localization";

let disposeSignalEffects: (() => void) | undefined;
let heartbeatTimer: number | undefined;

export function initSignalEffects(): void {
  disposeSignalEffects?.();

  try {
    const storedSimulation = sessionStorage.getItem("starter-template:offline-simulation");
    if (storedSimulation) {
      const parsed = JSON.parse(storedSimulation) as { enabled?: unknown; failNextReplay?: unknown };
      if (typeof parsed.enabled === "boolean" && typeof parsed.failNextReplay === "boolean") {
        patchOfflineSimulation({ enabled: parsed.enabled, failNextReplay: parsed.failNextReplay });
      }
    }
  } catch {
    // Session storage is optional for the offline simulator.
  }

  const preferencesStorage = createAppPreferencesStorage();
  disposeSignalEffects = effect(() => {
    preferencesStorage.write(sigAppPreferences.value);
  });

  let previousConnectivity = sigConnectivityStatus.value;
  const disposeConnectivity = effect(() => {
    const connectivity = sigConnectivityStatus.value;
    if (connectivity !== previousConnectivity) {
      toast[connectivity === ConnectivityStatus.ONLINE ? "success" : "warning"](
        connectivity === ConnectivityStatus.ONLINE ? "Connection restored." : "Working offline.",
        { id: "app-connectivity-transition" },
      );
      previousConnectivity = connectivity;
    }
  });

  const disposeSimulation = effect(() => {
    const simulation = sigOfflineSimulation.value;
    try {
      sessionStorage.setItem("starter-template:offline-simulation", JSON.stringify(simulation));
    } catch {
      // Simulation is an optional tab-local convenience.
    }
  });

  let previousSynchronizationSequence = sigSyncSummary.value.synchronizationSequence;
  const disposeSynchronization = effect(() => {
    const summary = sigSyncSummary.value;
    if (summary.synchronizationSequence === previousSynchronizationSequence) return;
    previousSynchronizationSequence = summary.synchronizationSequence;
    if (summary.lastSynchronizedCount > 0) {
      toast.success(
        appI18n.t("messages.synchronized", {
          count: summary.lastSynchronizedCount,
          ns: ITEM_TRANSLATION_NAMESPACE,
        }),
      );
    }
  });

  heartbeatTimer = window.setInterval(() => expireAppHeartbeat(), 1_000);
  const previousDispose = disposeSignalEffects;
  disposeSignalEffects = () => {
    previousDispose?.();
    disposeConnectivity();
    disposeSimulation();
    disposeSynchronization();
    if (heartbeatTimer !== undefined) window.clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  };
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeSignalEffects?.();
    disposeSignalEffects = undefined;
  });
}
