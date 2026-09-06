import { signal } from "@preact/signals-react";
import { DEFAULT_SYNC_SUMMARY, type AppSyncSummary } from "@/app/offline/models/AppOffline";

export const sigSyncSummary = signal<AppSyncSummary>(DEFAULT_SYNC_SUMMARY);
