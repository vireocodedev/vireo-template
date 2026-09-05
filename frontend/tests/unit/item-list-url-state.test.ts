import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITEM_LIST_URL_STATE,
  parseItemListUrlState,
  serializeItemListUrlState,
} from "@/pages/items/item-list-url-state";

const advancedFilters = {
  entity: "ITEM" as const,
  rows: [
    {
      kind: "leaf" as const,
      path: "status",
      operator: "EQUALS" as const,
      value: "ACTIVE",
      parameterized: false as const,
      selectedOptions: [],
    },
  ],
};

describe("Item-list URL state", () => {
  it("omits defaults and round-trips each non-default concern", () => {
    expect(serializeItemListUrlState(DEFAULT_ITEM_LIST_URL_STATE).toString()).toBe("");

    const state = {
      searchText: "scanner",
      queryFilters: advancedFilters,
      table: { page: 2, rowsPerPage: 20, sortBy: "quantity", sortDirection: "desc" as const },
    };
    const serialized = serializeItemListUrlState(state);

    expect([...serialized.keys()]).toEqual(["q", "page", "size", "sort", "direction", "filters"]);
    expect(serialized.get("filters")).toMatch(/^1:/u);
    expect(parseItemListUrlState(serialized)).toEqual(state);
  });

  it("recovers from unsupported values with safe defaults", () => {
    const state = parseItemListUrlState(
      new URLSearchParams({
        q: "  active  ",
        page: "-2",
        size: "999",
        sort: "privateField",
        direction: "sideways",
        filters: "2:{}",
      }),
    );

    expect(state).toEqual({ ...DEFAULT_ITEM_LIST_URL_STATE, searchText: "active" });
    expect(serializeItemListUrlState(state).toString()).toBe("q=active");
  });
});
