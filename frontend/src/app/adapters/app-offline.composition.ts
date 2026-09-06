import type { QueryClient } from "@tanstack/react-query";
import { ItemQuery } from "@/features/item/public";
import { configureOfflineItemsHydratedListener } from "./app-offline.adapter";

/** App composition owns query-cache knowledge; offline transport stays framework-agnostic. */
export function initializeAppOfflineComposition(queryClient: QueryClient): () => void {
  configureOfflineItemsHydratedListener(() => queryClient.invalidateQueries({ queryKey: ItemQuery.keys.all }));
  return () => configureOfflineItemsHydratedListener(undefined);
}
