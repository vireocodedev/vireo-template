import { HistoryQueryKeys } from "@/features/history/api/history.query";
import { itemApi } from "@/features/item/api/item.api.online";
import { ItemMutationKeys, ItemQuery, ItemQueryKeys } from "@/features/item/api/item.query";
import { createItemSearchQueryOptions, mergeItemSearchPages } from "@/features/item/hooks/useItemSearchQuery";
import {
  insertItemIntoUnfilteredSearchQueries,
  removeItemFromSearchQueries,
  replaceItemInSearchQueries,
  restoreItemSearchQueries,
  snapshotItemSearchQueries,
} from "@/features/item/services/itemQueryCache";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const pagination = {
  page: 0,
  rowsPerPage: 10,
  sortBy: "name",
  sortDirection: "asc" as const,
};

const filters = { searchText: "audit", queryFilters: null };

describe("item query contracts", () => {
  it("builds stable feature-owned paged and infinite search keys", () => {
    expect(ItemQuery.search(pagination, filters).queryKey).toEqual(["items", pagination, filters]);
    expect(ItemQuery.searchInfinite(pagination, filters).queryKey).toEqual(["items", "infinite", pagination, filters]);
  });

  it("keeps mutation keys under the Item cache root", () => {
    expect(ItemQueryKeys.all).toEqual(["items"]);
    expect(ItemMutationKeys.create).toEqual(["items", "create"]);
    expect(ItemMutationKeys.update).toEqual(["items", "update"]);
    expect(ItemMutationKeys.delete).toEqual(["items", "delete"]);
  });

  it("forwards TanStack cancellation to the Item API", async () => {
    const search = vi.spyOn(itemApi, "search").mockResolvedValue({
      content: [],
      number: 0,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    });
    const signal = new AbortController().signal;
    const options = ItemQuery.search(pagination, filters);

    await options.queryFn?.({ signal } as never);

    expect(search).toHaveBeenCalledWith(pagination, filters, { signal });
  });

  it("starts compact-layout searches at the URL-owned page", async () => {
    const search = vi.spyOn(itemApi, "search").mockResolvedValue({
      content: [],
      number: 1,
      size: 10,
      totalElements: 0,
      totalPages: 0,
    });
    const signal = new AbortController().signal;
    const options = createItemSearchQueryOptions({ ...pagination, page: 1 }, filters).infinite;

    await options.queryFn?.({ pageParam: options.initialPageParam, signal } as never);

    expect(options.initialPageParam).toBe(1);
    expect(search).toHaveBeenCalledWith({ ...pagination, page: 1 }, filters, { signal });
  });

  it("normalizes entity identifiers in history keys", () => {
    expect(HistoryQueryKeys.entity("ITEM", 42)).toEqual(["history", "ITEM", "42"]);
  });

  it("merges infinite Item pages without losing the server total", () => {
    const item = {
      id: "00000000-0000-4000-8000-000000000301",
      version: 0,
      name: "First",
      description: "",
      quantity: 1,
      status: "DRAFT" as const,
    };
    const merged = mergeItemSearchPages([
      { content: [item], number: 0, size: 1, totalElements: 2, totalPages: 2 },
      {
        content: [{ ...item, id: "00000000-0000-4000-8000-000000000302", name: "Second" }],
        number: 1,
        size: 1,
        totalElements: 2,
        totalPages: 2,
      },
    ]);

    expect(merged).toMatchObject({ number: 1, size: 2, totalElements: 2, totalPages: 2 });
    expect(merged?.content.map(row => row.name)).toEqual(["First", "Second"]);
  });

  it("updates and rolls back cached item searches without clearing usable rows", async () => {
    const queryClient = new QueryClient();
    const key = ItemQuery.search({ ...pagination, page: 0 }, { searchText: "", queryFilters: null }).queryKey;
    const first = {
      id: "00000000-0000-4000-8000-000000000303",
      version: 0,
      name: "First",
      description: "",
      quantity: 1,
      status: "DRAFT" as const,
    };
    const second = { ...first, id: "00000000-0000-4000-8000-000000000304", name: "Second" };
    queryClient.setQueryData(key, {
      content: [first, second],
      number: 0,
      size: 10,
      totalElements: 2,
      totalPages: 1,
    });

    const snapshot = await snapshotItemSearchQueries(queryClient);
    replaceItemInSearchQueries(queryClient, { ...first, name: "Updated" });
    expect(queryClient.getQueryData<{ content: (typeof first)[] }>(key)?.content[0].name).toBe("Updated");

    removeItemFromSearchQueries(queryClient, second.id);
    expect(queryClient.getQueryData<{ content: (typeof first)[]; totalElements: number }>(key)).toMatchObject({
      content: [{ ...first, name: "Updated" }],
      totalElements: 1,
    });

    restoreItemSearchQueries(queryClient, snapshot);
    expect(queryClient.getQueryData<{ content: (typeof first)[]; totalElements: number }>(key)).toMatchObject({
      content: [first, second],
      totalElements: 2,
    });
  });

  it("inserts created items only into unfiltered first-page caches in the active sort order", () => {
    const queryClient = new QueryClient();
    const unfilteredKey = ItemQuery.search(pagination, { searchText: "", queryFilters: null }).queryKey;
    const filteredKey = ItemQuery.search(pagination, filters).queryKey;
    const second = {
      id: "00000000-0000-4000-8000-000000000305",
      version: 0,
      name: "Second",
      description: "",
      quantity: 1,
      status: "DRAFT" as const,
    };
    const page = { content: [second], number: 0, size: 10, totalElements: 1, totalPages: 1 };
    queryClient.setQueryData(unfilteredKey, page);
    queryClient.setQueryData(filteredKey, page);

    const first = { ...second, id: "00000000-0000-4000-8000-000000000306", name: "First" };
    insertItemIntoUnfilteredSearchQueries(queryClient, first);

    expect(queryClient.getQueryData<{ content: (typeof first)[]; totalElements: number }>(unfilteredKey)).toMatchObject(
      {
        content: [first, second],
        totalElements: 2,
      },
    );
    expect(queryClient.getQueryData(filteredKey)).toEqual(page);
  });
});
