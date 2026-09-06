import { signal } from "@preact/signals-react";
import { DEFAULT_CACHE_READINESS, type AppCacheReadiness } from "@/app/offline/models/AppOffline";

export const sigCacheReadiness = signal<AppCacheReadiness>(DEFAULT_CACHE_READINESS);
