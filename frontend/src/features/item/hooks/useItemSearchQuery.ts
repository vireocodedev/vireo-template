import { ItemQuery } from "../api/item.query";
import type { ItemFilters } from "../api/item.api";
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { PageableParams, PageableResponse } from "@vireocodedev/infrastructure";
import { useVireoPageLayout } from "@vireocodedev/ui";
import type { Item } from "../models/Item";
import { useMediaQuery, useTheme } from "@mui/material";

export function useItemSearchQuery(pagination: PageableParams, filters: ItemFilters) {
  const { isCompact } = useVireoPageLayout();
  const theme = useTheme();
  // Four operational columns need more room than the general page-layout compact threshold provides.
  const constrainedViewport = useMediaQuery(theme.breakpoints.down("lg"));
  const useMobileLayout = isCompact || constrainedViewport;
  const paged = useQuery({
    ...ItemQuery.search(pagination, filters),
    enabled: !useMobileLayout,
    placeholderData: keepPreviousData,
  });
  const infinite = useInfiniteQuery({
    ...ItemQuery.searchInfinite(pagination, filters),
    enabled: useMobileLayout,
    initialPageParam: pagination.page,
    placeholderData: keepPreviousData,
  });
  const infiniteData = mergeItemSearchPages(infinite.data?.pages);
  const active = useMobileLayout ? infinite : paged;

  return {
    data: useMobileLayout ? (infiniteData ?? paged.data) : (paged.data ?? infiniteData),
    hasNextPage: useMobileLayout ? infinite.hasNextPage : undefined,
    isError: active.isError,
    isFetchingNextPage: useMobileLayout ? infinite.isFetchingNextPage : undefined,
    isRefreshing: active.isFetching && !active.isLoading && !(useMobileLayout && infinite.isFetchingNextPage),
    isLoading: active.isLoading,
    layout: useMobileLayout ? ("mobile" as const) : ("desktop" as const),
    onLoadNextPage: useMobileLayout ? infinite.fetchNextPage : undefined,
    onRetry: () => void active.refetch(),
  };
}

export function mergeItemSearchPages(
  pages: readonly PageableResponse<Item>[] | undefined,
): PageableResponse<Item> | undefined {
  if (!pages?.length) return undefined;
  const lastPage = pages.at(-1)!;
  const content = pages.flatMap(page => page.content);
  return { ...lastPage, content, size: content.length };
}
