import type { PageableParams, PageableResponse } from "@vireocodedev/infrastructure";
import type { Item } from "../models/Item";
import type { ItemFilters } from "../models/ItemFilters";

export type { ItemFilters } from "../models/ItemFilters";

export type ItemRequestOptions = {
  signal?: AbortSignal;
};

export type ItemMutationPersistence = "QUEUED" | "SAVED";

export type ItemMutationResult<TValue> = Readonly<{
  persistence: ItemMutationPersistence;
  value: TValue;
}>;

export interface ItemApi {
  search(
    pagination: PageableParams,
    filters: ItemFilters,
    request?: ItemRequestOptions,
  ): Promise<PageableResponse<Item>>;
  create(value: Item): Promise<ItemMutationResult<Item>>;
  update(id: string, value: Item): Promise<ItemMutationResult<Item>>;
  delete(id: string, version: number): Promise<ItemMutationResult<undefined>>;
}
