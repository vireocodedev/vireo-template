import { ItemMutationKeys, ItemQueryKeys } from "../api/item.query";
import { itemApi } from "../api/item.api.online";
import { useQueryClient } from "@tanstack/react-query";
import { useVireoMutation } from "@vireocodedev/ui/tanstack-query";
import { useItemTranslation } from "../localization/use-item-translation";
import type { Item } from "../models/Item";
import type { ItemMutationResult } from "../api/item.api";
import {
  removeItemFromSearchQueries,
  restoreItemSearchQueries,
  snapshotItemSearchQueries,
  type ItemSearchQuerySnapshot,
} from "../services/itemQueryCache";

export function useItemDeleteMutation() {
  const { t } = useItemTranslation();
  const queryClient = useQueryClient();

  return useVireoMutation<ItemMutationResult<Item>, Error, Item, ItemSearchQuerySnapshot>({
    mutationKey: ItemMutationKeys.delete,
    mutationFn: async item => {
      const result = await itemApi.delete(item.id, item.version);
      return { ...result, value: item };
    },
    successMessage: result =>
      t(result.persistence === "QUEUED" ? "messages.queued" : "messages.deleted", { name: result.value.name }),
    errorMessage: t("messages.deleteFailed"),
    onMutate: async item => {
      const snapshot = await snapshotItemSearchQueries(queryClient);
      removeItemFromSearchQueries(queryClient, item.id);
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => restoreItemSearchQueries(queryClient, snapshot),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ItemQueryKeys.all });
    },
  });
}
