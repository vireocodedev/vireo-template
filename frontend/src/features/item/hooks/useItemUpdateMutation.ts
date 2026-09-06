import { ItemMutationKeys, ItemQueryKeys } from "../api/item.query";
import { itemApi } from "../api/item.api.online";
import type { Item } from "../models/Item";
import type { ItemMutationResult } from "../api/item.api";
import { useQueryClient } from "@tanstack/react-query";
import { useVireoMutation } from "@vireocodedev/ui/tanstack-query";
import { useItemTranslation } from "../localization/use-item-translation";
import {
  replaceItemInSearchQueries,
  restoreItemSearchQueries,
  snapshotItemSearchQueries,
  type ItemSearchQuerySnapshot,
} from "../services/itemQueryCache";

type UpdateItemVariables = {
  id: string;
  value: Item;
};

export function useItemUpdateMutation() {
  const { t } = useItemTranslation();
  const queryClient = useQueryClient();

  return useVireoMutation<ItemMutationResult<Item>, Error, UpdateItemVariables, ItemSearchQuerySnapshot>({
    mutationKey: ItemMutationKeys.update,
    mutationFn: ({ id, value }: UpdateItemVariables) => itemApi.update(id, value),
    successMessage: result =>
      t(result.persistence === "QUEUED" ? "messages.queued" : "messages.updated", { name: result.value.name }),
    errorMessage: t("messages.updateFailed"),
    onMutate: async ({ id, value }) => {
      const snapshot = await snapshotItemSearchQueries(queryClient);
      replaceItemInSearchQueries(queryClient, { ...value, id });
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => restoreItemSearchQueries(queryClient, snapshot),
    onSuccess: result => {
      replaceItemInSearchQueries(queryClient, result.value);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ItemQueryKeys.all });
    },
  });
}
