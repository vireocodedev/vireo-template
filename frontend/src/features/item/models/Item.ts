import { z } from "zod";
import type { ValidatedSchemaFactory } from "@/app/ui/localization/validated-schema";
import { AppFormMode } from "@/app/ui/forms/models/AppFormMode";

export const ItemStatus = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export type ItemStatus = z.infer<typeof ItemStatus>;

const JAVA_INTEGER_MAX = 2_147_483_647;

export const ItemTransport = z.object({
  id: z.uuid(),
  version: z.number().int().nonnegative(),
  name: z.string(),
  description: z.string().nullable(),
  quantity: z.number().int().nonnegative().max(JAVA_INTEGER_MAX),
  status: ItemStatus,
});

export type ItemTransport = z.infer<typeof ItemTransport>;

export const Item = ItemTransport.extend({
  description: ItemTransport.shape.description.transform(value => value ?? ""),
});

export type Item = z.infer<typeof Item>;

/** The client-owned UUID makes an offline create idempotent when replayed. */
export const ItemCreateRequest = z.object({
  id: z.uuid(),
  name: z
    .string()
    .max(255)
    .refine(value => value.trim().length > 0),
  description: z.string().max(2000).nullable().optional(),
  quantity: z.number().int().nonnegative().max(JAVA_INTEGER_MAX),
  status: ItemStatus,
});

export type ItemCreateRequest = z.infer<typeof ItemCreateRequest>;

/**
 * The Item editor submits a complete mutable state, although PATCH permits a
 * future caller to send only the fields it changes. The resource ID remains in
 * the path; optimistic version is the only concurrency precondition in body.
 */
const ItemPatchRequestFields = z.object({
  version: z.number().int().nonnegative(),
  name: z
    .string()
    .max(255)
    .refine(value => value.trim().length > 0)
    .optional(),
  description: z.string().max(2000).nullable().optional(),
  quantity: z.number().int().nonnegative().max(JAVA_INTEGER_MAX).optional(),
  status: ItemStatus.optional(),
});

export const ItemPatchRequest = ItemPatchRequestFields.refine(
  request =>
    request.name !== undefined ||
    request.description !== undefined ||
    request.quantity !== undefined ||
    request.status !== undefined,
  { message: "An Item PATCH must include at least one mutable field." },
);

export type ItemPatchRequest = z.infer<typeof ItemPatchRequest>;

export function toItemCreateRequest(value: Item): ItemCreateRequest {
  return ItemCreateRequest.parse(value);
}

export function toCompleteItemPatchRequest(value: Item): Required<ItemPatchRequest> {
  return ItemPatchRequestFields.required().parse({
    name: value.name,
    description: value.description,
    quantity: value.quantity,
    status: value.status,
    version: value.version,
  });
}

export function getDefaultItem(): Item {
  return {
    id: crypto.randomUUID(),
    version: 0,
    name: "",
    description: "",
    quantity: 0,
    status: "DRAFT",
  };
}

export type ItemFormValidationContext = Readonly<{
  nameMinimumLength: number;
}>;

export type ItemValidatedSchemaContext = ItemFormValidationContext &
  Readonly<{
    mode: AppFormMode;
  }>;

export const DEFAULT_ITEM_FORM_VALIDATION_CONTEXT: ItemFormValidationContext = Object.freeze({
  nameMinimumLength: 2,
});

export const buildValidatedItemSchema: ValidatedSchemaFactory<Item, "item", ItemValidatedSchemaContext> = (
  t,
  context,
) => {
  if (context.mode === AppFormMode.enum.READ) return Item as z.ZodType<Item, Item>;

  return Item.extend({
    name: Item.shape.name
      .trim()
      .min(context.nameMinimumLength, t("validation.name.min", { minimum: context.nameMinimumLength })),
    description: Item.shape.description.refine(value => value.length <= 2000, {
      message: t("validation.description.max"),
    }),
    quantity: Item.shape.quantity
      .int(t("validation.quantity.integer"))
      .nonnegative(t("validation.quantity.nonnegative")),
  }) as z.ZodType<Item, Item>;
};
