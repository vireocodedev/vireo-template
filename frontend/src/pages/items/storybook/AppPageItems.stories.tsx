import { useDebouncedSearchText, type EntityQueryFilterPresentation } from "@/features/entity-query-filters/public";
import type { Item } from "@/features/item/public";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { VireoResponsiveTableFilters } from "@vireocodedev/ui";
import { Button } from "@mui/material";
import React from "react";
import { expect, fn, waitFor, within } from "storybook/test";
import { measureUnexpectedLayoutShift } from "@/app/storybook/loadingGeometry";
import { AppPageItemsFrame, AppPageItemsListView, type AppPageItemsListState } from "../AppPageItems";

type ItemsStoryState = "loaded" | "loading" | "refreshing" | "refresh-error" | "empty" | "error";

const items: Item[] = [
  {
    id: "00000000-0000-4000-8000-000000000021",
    version: 0,
    name: "Design system audit",
    description: "Review the application against current Vireo contracts.",
    quantity: 4,
    status: "ACTIVE",
  },
  {
    id: "00000000-0000-4000-8000-000000000022",
    version: 0,
    name: "Offline workflow",
    description: "Verify retained content after reconnecting.",
    quantity: 2,
    status: "DRAFT",
  },
  {
    id: "00000000-0000-4000-8000-000000000023",
    version: 0,
    name: "Legacy cleanup",
    description: "Remove the final compatibility component.",
    quantity: 0,
    status: "ARCHIVED",
  },
];

const presentation: EntityQueryFilterPresentation = {
  fields: {
    name: { label: "Name" },
    description: { label: "Description" },
    quantity: { label: "Quantity" },
    status: { label: "Status" },
  },
};

const filters: VireoResponsiveTableFilters = {
  page: 0,
  rowsPerPage: 10,
  sortBy: "name",
  sortDirection: "asc",
};

const callbacks = {
  clearAll: fn(),
  clearQuery: fn(),
  create: fn(),
  delete: fn(async () => undefined),
  edit: fn(),
  filters: fn(),
  history: fn(),
  removeQuery: fn(),
  retry: fn(),
};

function resultFor(state: ItemsStoryState, layout: "desktop" | "mobile"): AppPageItemsListState {
  const resolvedData = {
    content: state === "empty" ? [] : items,
    number: 0,
    size: 10,
    totalElements: state === "empty" ? 0 : items.length,
    totalPages: state === "empty" ? 0 : 1,
  };

  return {
    data: state === "loading" || state === "error" ? undefined : resolvedData,
    hasNextPage: false,
    isError: state === "error" || state === "refresh-error",
    isFetchingNextPage: false,
    isLoading: state === "loading",
    isRefreshing: state === "refreshing",
    layout,
    onLoadNextPage: undefined,
    onRetry: callbacks.retry,
  };
}

function ItemsStoryFixture({ layout = "desktop", state }: { layout?: "desktop" | "mobile"; state: ItemsStoryState }) {
  const search = useDebouncedSearchText("", 0);
  const [tableFilters, setTableFilters] = React.useState(filters);

  return (
    <div style={{ height: "100vh", minHeight: 620 }}>
      <AppPageItemsFrame canManage onOpenCreate={callbacks.create}>
        <AppPageItemsListView
          canManage
          filters={tableFilters}
          onFiltersChange={setTableFilters}
          queryFilters={null}
          search={search}
          structuredFilterCount={0}
          tableSize="medium"
          presentation={presentation}
          onClearQueryFilters={callbacks.clearQuery}
          onClearAllFilters={callbacks.clearAll}
          onRemoveQueryFilter={callbacks.removeQuery}
          onOpenEdit={callbacks.edit}
          onOpenCreate={callbacks.create}
          onOpenFilters={callbacks.filters}
          onOpenHistory={callbacks.history}
          onRequestDelete={callbacks.delete}
          result={resultFor(state, layout)}
        />
      </AppPageItemsFrame>
    </div>
  );
}

const meta = {
  title: "PAGES/Items",
  component: ItemsStoryFixture,
  args: { state: "loaded" },
  parameters: {
    controls: { disable: true },
    vireo: {
      loading: {
        categories: ["boundary", "content-preserving", "skeleton-capable"],
        geometry: "B",
      },
    },
    docs: {
      description: {
        component:
          "Items is the Level B data-workflow pilot. Its real toolbar, responsive table/list frame, and pagination remain mounted across initial loading, retained refresh, empty, and error states.",
      },
    },
  },
} satisfies Meta<typeof ItemsStoryFixture>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Design system audit")).toBeVisible();
    await expect(canvasElement.querySelector('[data-items-result-count="desktop"]')).toBeNull();
    await expect(canvasElement.querySelector('[data-items-result-count="mobile"]')).toHaveTextContent("3 results");
  },
};

export const Loading: Story = {
  args: { state: "loading" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByPlaceholderText("Search by name, description or status")).toBeVisible();
    await expect(canvas.findByRole("status")).resolves.toHaveTextContent("Loading items");
  },
};

export const Refreshing: Story = {
  args: { state: "refreshing" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Design system audit")).toBeVisible();
    await expect(canvas.findByRole("status")).resolves.toHaveTextContent("Refreshing items");
    await expect(canvasElement.querySelector(".MuiSkeleton-root")).toBeNull();
  },
};

export const Empty: Story = {
  args: { state: "empty" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-items-empty-state]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-items-initial-error]")).toBeNull();
  },
};

export const Error: Story = {
  args: { state: "error" },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("[data-items-initial-error]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-items-empty-state]")).toBeNull();
  },
};

export const RefreshError: Story = {
  args: { state: "refresh-error" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Design system audit")).toBeVisible();
    await expect(canvasElement.querySelector("[data-items-refresh-error]")).not.toBeNull();
    await expect(canvasElement.querySelector("[data-items-initial-error]")).toBeNull();
  },
};

const alignmentSelectors = [
  "[data-app-page-scroll-region]",
  "[data-items-search]",
  "[data-items-data-state]",
  "[data-items-table]",
] as const;

function measureAlignmentAnchors(canvasElement: HTMLElement) {
  return alignmentSelectors.map(selector => {
    const element = canvasElement.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new globalThis.Error(`Missing Items alignment anchor: ${selector}`);
    const { height, width, x, y } = element.getBoundingClientRect();
    return { height, selector, width, x, y };
  });
}

function AlignmentContractFixture() {
  const [state, setState] = React.useState<ItemsStoryState>("loaded");

  return (
    <>
      <Button
        data-testid="toggle-items-loading"
        onClick={() => setState(current => (current === "loaded" ? "loading" : "loaded"))}
        sx={{ position: "fixed", right: 8, top: 8, zIndex: theme => theme.zIndex.tooltip + 1 }}
      >
        Toggle loading
      </Button>
      <ItemsStoryFixture state={state} />
    </>
  );
}

export const AlignmentContract: Story = {
  render: () => <AlignmentContractFixture />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const loaded = measureAlignmentAnchors(canvasElement);

    const layoutShift = await measureUnexpectedLayoutShift(async () => {
      canvas.getByTestId("toggle-items-loading").click();
      await waitFor(() =>
        expect(canvasElement.querySelector('[data-items-table] [data-loading-state="visible"]')).not.toBeNull(),
      );
    });
    expect(layoutShift).toBeLessThanOrEqual(0.01);

    const loading = measureAlignmentAnchors(canvasElement);
    loading.forEach((measurement, index) => {
      const expected = loaded[index];
      expect(measurement.selector).toBe(expected.selector);
      expect(measurement.x).toBeCloseTo(expected.x, 1);
      expect(measurement.y).toBeCloseTo(expected.y, 1);
      expect(measurement.width).toBeCloseTo(expected.width, 1);
      expect(measurement.height).toBeCloseTo(expected.height, 1);
    });
  },
};
