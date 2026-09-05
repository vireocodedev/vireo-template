import { parseQueryFilterDocument, serializeQueryFilterDocument } from "@/app/data/query/models/QueryFilterDocument";
import { APP_QUERY_ENTITY } from "@/app/data/query/models/AppQueryEntityKey";
import type { QueryFilterDocument } from "@/app/data/query/models/QueryFilterDocument";
import type { VireoResponsiveTableFilters } from "@vireocodedev/ui";

const FILTERS_VERSION = "1";
const PAGE_SIZES = new Set([10, 20, 50, 100]);
const SORT_KEYS = new Set(["name", "quantity", "status"]);

export type ItemListUrlState = {
  searchText: string;
  queryFilters: QueryFilterDocument | null;
  table: VireoResponsiveTableFilters;
};

export const DEFAULT_ITEM_LIST_URL_STATE: ItemListUrlState = {
  searchText: "",
  queryFilters: null,
  table: { page: 0, rowsPerPage: 10, sortBy: "name", sortDirection: "asc" },
};

function parseInteger(value: string | null, valid: (value: number) => boolean, fallback: number): number {
  if (value == null || !/^\d+$/u.test(value)) return fallback;
  const parsed = Number.parseInt(value, 10);
  return valid(parsed) ? parsed : fallback;
}

function parseAdvancedFilters(value: string | null): QueryFilterDocument | null {
  if (!value?.startsWith(`${FILTERS_VERSION}:`)) return null;
  try {
    return parseQueryFilterDocument(JSON.parse(value.slice(FILTERS_VERSION.length + 1)), APP_QUERY_ENTITY.item);
  } catch {
    return null;
  }
}

export function parseItemListUrlState(params: URLSearchParams): ItemListUrlState {
  const sortBy = params.get("sort");
  const sortDirection = params.get("direction");
  return {
    searchText: params.get("q")?.trim() ?? "",
    queryFilters: parseAdvancedFilters(params.get("filters")),
    table: {
      page: parseInteger(params.get("page"), value => value >= 0, DEFAULT_ITEM_LIST_URL_STATE.table.page),
      rowsPerPage: parseInteger(
        params.get("size"),
        value => PAGE_SIZES.has(value),
        DEFAULT_ITEM_LIST_URL_STATE.table.rowsPerPage,
      ),
      sortBy: sortBy && SORT_KEYS.has(sortBy) ? sortBy : DEFAULT_ITEM_LIST_URL_STATE.table.sortBy,
      sortDirection: sortDirection === "desc" ? "desc" : DEFAULT_ITEM_LIST_URL_STATE.table.sortDirection,
    },
  };
}

export function serializeItemListUrlState(state: ItemListUrlState): URLSearchParams {
  const params = new URLSearchParams();
  const searchText = state.searchText.trim();
  if (searchText) params.set("q", searchText);
  if (state.table.page !== DEFAULT_ITEM_LIST_URL_STATE.table.page) params.set("page", String(state.table.page));
  if (state.table.rowsPerPage !== DEFAULT_ITEM_LIST_URL_STATE.table.rowsPerPage) {
    params.set("size", String(state.table.rowsPerPage));
  }
  if (state.table.sortBy !== DEFAULT_ITEM_LIST_URL_STATE.table.sortBy) params.set("sort", state.table.sortBy);
  if (state.table.sortDirection !== DEFAULT_ITEM_LIST_URL_STATE.table.sortDirection) {
    params.set("direction", state.table.sortDirection);
  }
  const serializedFilters = serializeQueryFilterDocument(state.queryFilters, APP_QUERY_ENTITY.item);
  if (serializedFilters) params.set("filters", `${FILTERS_VERSION}:${serializedFilters}`);
  return params;
}
