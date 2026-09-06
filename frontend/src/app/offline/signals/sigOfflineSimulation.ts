import { signal } from "@preact/signals-react";
import { DEFAULT_OFFLINE_SIMULATION, type AppOfflineSimulation } from "@/app/offline/models/AppOffline";

export const sigOfflineSimulation = signal<AppOfflineSimulation>(DEFAULT_OFFLINE_SIMULATION);
