import { signal } from "@preact/signals-react";
import { ConnectivityStatus } from "@/app/offline/models/AppOffline";

export const sigConnectivityStatus = signal<ConnectivityStatus>(ConnectivityStatus.OFFLINE);
