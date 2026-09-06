import { HistoryQuery } from "@/features/history/public";
import { ITEM_HISTORY_ENTITY, ItemHistoryRecordSchema } from "../models/ItemHistory";
import { useQuery } from "@tanstack/react-query";

export function useItemHistory(itemId: string, enabled: boolean) {
  return useQuery({
    ...HistoryQuery.entity(ItemHistoryRecordSchema, ITEM_HISTORY_ENTITY, itemId),
    enabled,
  });
}
