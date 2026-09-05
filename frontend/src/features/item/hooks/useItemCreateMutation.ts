import { ItemMutationKeys, ItemQueryKeys } from "../api/item.query";
import { itemApi } from "../api/item.api.online";
import { useQueryClient } from "@tanstack/react-query";
import { useVireoMutation } from "@vireocodedev/ui/tanstack-query";
import { useItemTranslation } from "../localization/use-item-translation";
import type { Item } from "../models/Item";
import type { ItemMutationResult } from "../api/item.api";
import { insertItemIntoUnfilteredSearchQueries } from "../services/itemQueryCache";

export function useItemCreateMutation() {
  const { t } = useItemTranslation();
  const queryClient = useQueryClient();

  return useVireoMutation<ItemMutationResult<Item>, Error, Item>({
    mutationKey: ItemMutationKeys.create,
    mutationFn: itemApi.create.bind(itemApi),
    successMessage: result =>
      t(result.persistence === "QUEUED" ? "messages.queued" : "messages.created", { name: result.value.name }),
    errorMessage: t("messages.createFailed"),
    onSuccess: result => {
      const item = result.value;
      insertItemIntoUnfilteredSearchQueries(queryClient, item);
      if (result.persistence === "SAVED") {
        void queryClient.invalidateQueries({ queryKey: ItemQueryKeys.all });
      }
    },
  });
}
