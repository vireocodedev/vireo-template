import { Item } from "./Item";
import { createHistoryDefinition, createHistoryRecordSchema } from "@vireocodedev/history";
import { z } from "zod";
import type { TFunction } from "i18next";
import type { ITEM_TRANSLATION_NAMESPACE } from "@/app/app.localization";

export const ITEM_HISTORY_ENTITY = "ITEM" as const;

export const ItemHistoryRecordSchema = createHistoryRecordSchema({
  entityKind: z.literal(ITEM_HISTORY_ENTITY),
  snapshot: Item,
});

export function createItemHistoryDefinition(t: TFunction<typeof ITEM_TRANSLATION_NAMESPACE>, locale?: string) {
  return createHistoryDefinition(
    Item,
    {
      label: t("title"),
      key: item => item.id,
      format: item => item.name,
    },
    {
      id: false,
      version: false,
      name: { kind: "field", label: t("fields.name") },
      description: { kind: "field", label: t("fields.description") },
      quantity: {
        kind: "field",
        label: t("fields.quantity"),
        format: quantity => quantity.toLocaleString(locale),
      },
      status: {
        kind: "field",
        label: t("fields.status"),
        format: status => t(`status.${status}`),
      },
    },
  );
}
