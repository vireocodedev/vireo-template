import { ItemQueryKeys } from "../api/item.query";
import type { ItemFilters } from "../models/ItemFilters";
import type { Item } from "../models/Item";
import type { PageableParams, PageableResponse } from "@vireocodedev/infrastructure";
import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";

export type ItemSearchQuerySnapshot = readonly (readonly [QueryKey, unknown])[];

function isPage(value: unknown): value is PageableResponse<Item> {
  return (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    Array.isArray(value.content) &&
    "totalElements" in value &&
    typeof value.totalElements === "number"
  );
}

function isInfinite(value: unknown): value is InfiniteData<PageableResponse<Item>, unknown> {
  return typeof value === "object" && value !== null && "pages" in value && Array.isArray(value.pages);
}

function mapItemSearchData(data: unknown, mapPage: (page: PageableResponse<Item>) => PageableResponse<Item>): unknown {
  if (isPage(data)) return mapPage(data);
  if (isInfinite(data) && data.pages.every(isPage)) return { ...data, pages: data.pages.map(mapPage) };
  return data;
}

export async function snapshotItemSearchQueries(queryClient: QueryClient): Promise<ItemSearchQuerySnapshot> {
  await queryClient.cancelQueries({ queryKey: ItemQueryKeys.all });
  return queryClient.getQueriesData({ queryKey: ItemQueryKeys.all });
}

export function restoreItemSearchQueries(queryClient: QueryClient, snapshot?: ItemSearchQuerySnapshot): void {
  snapshot?.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
}

export function replaceItemInSearchQueries(queryClient: QueryClient, item: Item): void {
  queryClient.setQueriesData({ queryKey: ItemQueryKeys.all }, data =>
    mapItemSearchData(data, page => {
      if (!page.content.some(row => row.id === item.id)) return page;
      return { ...page, content: page.content.map(row => (row.id === item.id ? item : row)) };
    }),
  );
}

export function removeItemFromSearchQueries(queryClient: QueryClient, itemId: string): void {
  queryClient.setQueriesData({ queryKey: ItemQueryKeys.all }, data => {
    if (isPage(data)) {
      if (!data.content.some(item => item.id === itemId)) return data;
      return {
        ...data,
        content: data.content.filter(item => item.id !== itemId),
        totalElements: Math.max(0, data.totalElements - 1),
      };
    }
    if (!isInfinite(data) || !data.pages.every(isPage)) return data;
    if (!data.pages.some(page => page.content.some(item => item.id === itemId))) return data;
    const totalElements = Math.max(0, data.pages[0]?.totalElements - 1);
    return {
      ...data,
      pages: data.pages.map(page => ({
        ...page,
        content: page.content.filter(item => item.id !== itemId),
        totalElements,
      })),
    };
  });
}

function getUnfilteredSearchMetadata(
  queryKey: QueryKey,
): { infinite: boolean; pagination: PageableParams; filters: ItemFilters } | null {
  if (queryKey[0] !== ItemQueryKeys.all[0]) return null;
  const infinite = queryKey[1] === "infinite";
  const pagination = queryKey[infinite ? 2 : 1];
  const filters = queryKey[infinite ? 3 : 2];
  if (typeof pagination !== "object" || pagination === null || typeof filters !== "object" || filters === null) {
    return null;
  }
  const candidatePagination = pagination as Partial<PageableParams>;
  const candidateFilters = filters as Partial<ItemFilters>;
  if (
    typeof candidatePagination.page !== "number" ||
    typeof candidatePagination.rowsPerPage !== "number" ||
    typeof candidatePagination.sortBy !== "string" ||
    (candidatePagination.sortDirection !== "asc" && candidatePagination.sortDirection !== "desc") ||
    typeof candidateFilters.searchText !== "string" ||
    candidateFilters.searchText.trim() !== "" ||
    candidateFilters.queryFilters != null
  ) {
    return null;
  }
  return { infinite, pagination: candidatePagination as PageableParams, filters: candidateFilters as ItemFilters };
}

function compareItems(left: Item, right: Item, pagination: PageableParams): number {
  const leftValue = left[pagination.sortBy as keyof Item];
  const rightValue = right[pagination.sortBy as keyof Item];
  const comparison =
    typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
  return pagination.sortDirection === "asc" ? comparison : -comparison;
}

function withInsertedItem(
  page: PageableResponse<Item>,
  item: Item,
  pagination: PageableParams,
  content: Item[],
): PageableResponse<Item> {
  const totalElements = page.totalElements + (page.content.some(row => row.id === item.id) ? 0 : 1);
  return {
    ...page,
    content,
    totalElements,
    totalPages: Math.ceil(totalElements / pagination.rowsPerPage),
  };
}

export function insertItemIntoUnfilteredSearchQueries(queryClient: QueryClient, item: Item): void {
  queryClient.getQueriesData({ queryKey: ItemQueryKeys.all }).forEach(([queryKey, data]) => {
    const metadata = getUnfilteredSearchMetadata(queryKey);
    if (!metadata) return;
    const { infinite, pagination } = metadata;
    if (!infinite) {
      if (pagination.page !== 0 || !isPage(data)) return;
      const content = [item, ...data.content.filter(row => row.id !== item.id)]
        .sort((left, right) => compareItems(left, right, pagination))
        .slice(0, pagination.rowsPerPage);
      queryClient.setQueryData(queryKey, withInsertedItem(data, item, pagination, content));
      return;
    }
    if (!isInfinite(data) || !data.pages.every(isPage) || data.pages.length === 0) return;
    const existing = data.pages.some(page => page.content.some(row => row.id === item.id));
    const loaded = [item, ...data.pages.flatMap(page => page.content).filter(row => row.id !== item.id)].sort(
      (left, right) => compareItems(left, right, pagination),
    );
    queryClient.setQueryData(queryKey, {
      ...data,
      pages: data.pages.map((page, pageIndex) => {
        const start = pageIndex * pagination.rowsPerPage;
        const content = loaded.slice(start, start + pagination.rowsPerPage);
        const next = withInsertedItem(page, item, pagination, content);
        return existing ? { ...next, totalElements: page.totalElements } : next;
      }),
    });
  });
}
