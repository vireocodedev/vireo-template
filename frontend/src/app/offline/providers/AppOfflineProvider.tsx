import React from "react";
import axios from "axios";
import { z } from "zod";
import { useVireoEventSource } from "@vireocodedev/ui/event-source";
import { useQueryClient } from "@tanstack/react-query";
import { appConfig } from "@/app/config/app-config";
import { appAxios } from "@/app/data/network/clients/AppAxiosClient";
import { useAppAuth } from "@/app/shell/hooks/useAppAuth";
import { recordAppHeartbeat } from "../services/app-offline-heartbeat";
import { ConnectivityStatus } from "../models/AppOffline";
import { sigConnectivityStatus } from "../signals/sigConnectivityStatus";
import { sigOfflineSimulation } from "../signals/sigOfflineSimulation";
import { requestOfflineHydration } from "../services/app-offline-hydration";

const loadOfflineAdapter = () => import("@/app/adapters/app-offline.adapter");

function hydrateAfterBatch(): void {
  void loadOfflineAdapter()
    .then(({ hydrateOfflineItems }) => requestOfflineHydration(hydrateOfflineItems))
    .catch(() => undefined);
}

const Heartbeat = z.object({ serverTime: z.string(), syncInProgress: z.boolean() });
const Batch = z.object({
  batchId: z.string(),
  events: z.array(
    z.object({
      action: z.enum(["create", "update", "delete"]),
      entity: z.literal("Item"),
      payload: z.object({ id: z.uuid(), version: z.number().int().nonnegative().nullable() }),
      revision: z.number().int().nonnegative().nullable(),
    }),
  ),
});

/** Application policy around Vireo's transport-neutral cache, queue and EventSource primitives. */
export function AppOfflineProvider({ children }: React.PropsWithChildren) {
  const { expireSession, user } = useAppAuth();
  const queryClient = useQueryClient();
  const simulation = sigOfflineSimulation.value;
  const connectivity = sigConnectivityStatus.value;
  const previousConnectivity = React.useRef(connectivity);
  const lastAuthProbeAt = React.useRef(0);

  React.useEffect(() => {
    if (user === null) return;
    void loadOfflineAdapter()
      .then(({ initializeOfflineData }) => initializeOfflineData())
      .catch(() => undefined);
  }, [user]);

  React.useEffect(() => {
    if (user === null) return;
    let cleanup: (() => void) | undefined;
    let disposed = false;
    void import("@/app/adapters/app-offline.composition")
      .then(({ initializeAppOfflineComposition }) => {
        if (!disposed) cleanup = initializeAppOfflineComposition(queryClient);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [queryClient, user]);

  useVireoEventSource({
    url: "/api/offline/heartbeat/stream",
    enabled: appConfig.apiMode === "http" && user !== null && !simulation.enabled,
    withCredentials: true,
    listeners: {
      heartbeat: event => {
        Heartbeat.parse(JSON.parse(event.data));
        recordAppHeartbeat();
      },
      batch: event => {
        Batch.parse(JSON.parse(event.data));
        hydrateAfterBatch();
      },
    },
    onListenerError: () => {
      // An invalid event never advances heartbeat state or silently changes cached data.
    },
    onError: () => {
      const now = Date.now();
      if (now - lastAuthProbeAt.current < 5_000) return;
      lastAuthProbeAt.current = now;
      void appAxios.get("/app/current-user", { timeout: 8_000 }).catch(error => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          expireSession();
          void loadOfflineAdapter()
            .then(({ purgeOfflineData }) => purgeOfflineData())
            .catch(() => undefined);
        }
      });
    },
  });

  React.useEffect(() => {
    if (appConfig.apiMode !== "mock" || user === null || simulation.enabled) return;
    recordAppHeartbeat();
    const timer = window.setInterval(recordAppHeartbeat, 5_000);
    return () => window.clearInterval(timer);
  }, [simulation.enabled, user]);

  React.useEffect(() => {
    const recovered =
      previousConnectivity.current === ConnectivityStatus.OFFLINE && connectivity === ConnectivityStatus.ONLINE;
    previousConnectivity.current = connectivity;
    if (!recovered || user === null) return;
    void loadOfflineAdapter()
      .then(({ recoverOfflineItems }) => recoverOfflineItems())
      .catch(() => queryClient.invalidateQueries());
  }, [connectivity, queryClient, user]);

  return <>{children}</>;
}
