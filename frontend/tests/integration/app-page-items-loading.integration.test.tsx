import { AppStorybookProvider } from "@/app/storybook/AppStorybookProvider";
import { useDebouncedSearchText, type EntityQueryFilterPresentation } from "@/features/entity-query-filters/public";
import type { Item } from "@/features/item/public";
import { AppPageItemsFrame, AppPageItemsListView, type AppPageItemsListState } from "@/pages/items/AppPageItems";
import type { VireoResponsiveTableFilters } from "@vireocodedev/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterAll(() => vi.unstubAllGlobals());

const item: Item = {
  id: "00000000-0000-4000-8000-000000000102",
  version: 0,
  name: "Design system audit",
  description: "Review the application against current Vireo contracts.",
  quantity: 4,
  status: "ACTIVE",
};

const page = {
  content: [item],
  number: 0,
  size: 10,
  totalElements: 1,
  totalPages: 1,
};

const presentation: EntityQueryFilterPresentation = {
  fields: {
    name: { label: "Name" },
    description: { label: "Description" },
    quantity: { label: "Quantity" },
    status: { label: "Status" },
  },
};

function itemListState(overrides: Partial<AppPageItemsListState> = {}): AppPageItemsListState {
  return {
    data: page,
    hasNextPage: undefined,
    isError: false,
    isFetchingNextPage: undefined,
    isLoading: false,
    isRefreshing: false,
    layout: "desktop",
    onLoadNextPage: undefined,
    onRetry: vi.fn(),
    ...overrides,
  };
}

function ItemsFixture({
  result,
  tableSize = "medium",
}: {
  result: AppPageItemsListState;
  tableSize?: "small" | "medium";
}) {
  const search = useDebouncedSearchText("", 0);
  const [filters, setFilters] = React.useState<VireoResponsiveTableFilters>({
    page: 0,
    rowsPerPage: 10,
    sortBy: "name",
    sortDirection: "asc",
  });

  return (
    <div style={{ height: 720 }}>
      <AppPageItemsFrame canManage onOpenCreate={vi.fn()}>
        <AppPageItemsListView
          canManage
          filters={filters}
          onFiltersChange={setFilters}
          queryFilters={null}
          search={search}
          structuredFilterCount={0}
          tableSize={tableSize}
          presentation={presentation}
          onClearQueryFilters={vi.fn()}
          onClearAllFilters={vi.fn()}
          onRemoveQueryFilter={vi.fn()}
          onOpenEdit={vi.fn()}
          onOpenCreate={vi.fn()}
          onOpenFilters={vi.fn()}
          onOpenHistory={vi.fn()}
          onRequestDelete={vi.fn(async () => undefined)}
          result={result}
        />
      </AppPageItemsFrame>
    </div>
  );
}

function renderItems(result: AppPageItemsListState, tableSize?: "small" | "medium") {
  return render(
    <AppStorybookProvider>
      <ItemsFixture result={result} tableSize={tableSize} />
    </AppStorybookProvider>,
  );
}

describe("Items loading-state contract", () => {
  it("keeps the real toolbar and one busy table boundary during initial loading", async () => {
    const view = renderItems(itemListState({ data: undefined, isLoading: true }));

    expect(screen.getByPlaceholderText("Search by name, description or status")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Filters" }).length).toBeGreaterThan(0);
    expect(view.container.querySelectorAll('[data-items-result-count-state="reserved"]')).toHaveLength(1);
    expect(view.container.querySelector('[data-items-result-count="desktop"]')).toBeNull();
    expect(view.container.querySelector('[data-items-result-count="mobile"]')).not.toBeNull();
    expect(view.container.querySelector('[data-items-data-state="loading"]')).not.toBeNull();
    expect(view.container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Loading items");
  });

  it("renders first-load failure as the exclusive table content state", () => {
    const retry = vi.fn();
    const view = renderItems(itemListState({ data: undefined, isError: true, onRetry: retry }));

    expect(view.container.querySelector('[data-items-data-state="error"]')).not.toBeNull();
    expect(view.container.querySelector("[data-items-initial-error]")).not.toBeNull();
    expect(view.container.querySelector("[data-items-empty-state]")).toBeNull();
    expect(view.container.querySelector("[data-items-refresh-error]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("preserves rows and owns one delayed announcement during refresh", async () => {
    const view = renderItems(itemListState({ isRefreshing: true }));

    expect(screen.getByText(item.name)).toBeVisible();
    expect(view.container.querySelector('[data-items-result-count-state="resolved"]')).not.toBeNull();
    expect(view.container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(view.container.querySelector(".MuiSkeleton-root")).toBeNull();
    expect(await screen.findByRole("status")).toHaveTextContent("Refreshing items");
    expect(view.container.querySelector('[role="progressbar"]')).toHaveAttribute("aria-hidden", "true");
  });

  it("retains resolved rows and shows a recoverable refresh warning", () => {
    const retry = vi.fn();
    const view = renderItems(itemListState({ isError: true, onRetry: retry }));

    expect(screen.getByText(item.name)).toBeVisible();
    expect(view.container.querySelector("[data-items-refresh-error]")).not.toBeNull();
    expect(view.container.querySelector("[data-items-initial-error]")).toBeNull();
    expect(view.container.querySelector("[data-items-empty-state]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("renders a resolved empty result without error messaging", () => {
    const view = renderItems(itemListState({ data: { ...page, content: [], totalElements: 0, totalPages: 0 } }));

    expect(view.container.querySelector('[data-items-data-state="empty"]')).not.toBeNull();
    expect(view.container.querySelector("[data-items-empty-state]")).not.toBeNull();
    expect(view.container.querySelector("[data-items-initial-error]")).toBeNull();
    expect(view.container.querySelector("[data-items-refresh-error]")).toBeNull();
  });

  it("keeps the same contract in the compact mobile list at small density", async () => {
    const view = renderItems(itemListState({ data: undefined, isLoading: true, layout: "mobile" }), "small");

    expect(view.container.querySelector('[data-items-table][data-container-layout="mobile"]')).not.toBeNull();
    expect(view.container.querySelector("[data-items-toolbar]")).toBeNull();
    expect(view.container.querySelector("[data-items-search]")).not.toBeNull();
    expect(view.container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Loading items");
  });
});
