import { AppStorybookProvider } from "@/app/storybook/AppStorybookProvider";
import { EntityQueryFiltersOverlay } from "@/features/entity-query-filters/components/EntityQueryFiltersOverlay";
import { useQuery } from "@tanstack/react-query";
import type { QueryEngineEntityDefinition } from "@vireocodedev/query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-query", async importOriginal => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: vi.fn(),
}));

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

const definition: QueryEngineEntityDefinition = {
  key: "ITEM",
  title: "item.title",
  fields: [
    {
      path: "name",
      label: "item.fields.name",
      type: "STRING",
      enumType: null,
      enumValues: [],
      operators: ["CONTAINS", "EQUALS"],
      relation: false,
      relationEntityKey: null,
      relationMode: "CHILD",
      multiple: false,
      relationSelectionLabelFields: [],
      expandable: false,
      maxDepth: 0,
      children: [],
    },
  ],
};
const refetch = vi.fn(async () => undefined);

function definitionState(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isError: false,
    isFetching: false,
    isPending: false,
    refetch,
    ...overrides,
  };
}

function renderFilters(onApply = vi.fn()) {
  return render(
    <AppStorybookProvider>
      <EntityQueryFiltersOverlay
        entityKey="ITEM"
        title="Filter items"
        open
        value={null}
        onApply={onApply}
        onClear={vi.fn()}
        onClose={vi.fn()}
      />
    </AppStorybookProvider>,
  );
}

describe("Entity query-filter overlay loading-state contract", () => {
  beforeEach(() => refetch.mockClear());

  it("reserves the unknown definition region behind one delayed progress boundary", async () => {
    vi.mocked(useQuery).mockReturnValue(definitionState({ isFetching: true, isPending: true }) as never);
    renderFilters();

    expect(screen.getByText("Filter items")).toBeVisible();
    expect(document.querySelector('[data-filter-definition-state="loading"]')).not.toBeNull();
    expect(document.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(await screen.findByRole("status")).toHaveTextContent("Loading filter fields");
    expect(screen.getByRole("progressbar", { hidden: true })).toHaveAttribute("aria-hidden", "true");
  });

  it("retains the usable form and enables Apply while refreshing", async () => {
    vi.mocked(useQuery).mockReturnValue(definitionState({ data: definition, isFetching: true }) as never);
    renderFilters();

    expect(screen.getByText("No structured filters are applied. Add a rule to narrow the results.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(document.querySelector('[data-filter-definition-state="refreshing"]')).not.toBeNull();
    expect(document.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Loading filter fields");
  });

  it("distinguishes recoverable initial failure from retained-definition failure", () => {
    vi.mocked(useQuery).mockReturnValue(definitionState({ isError: true }) as never);
    const initialError = renderFilters();

    expect(screen.getByText("Filter fields could not be loaded.")).toBeVisible();
    expect(screen.queryByText("No structured filters are applied. Add a rule to narrow the results.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
    initialError.unmount();

    vi.mocked(useQuery).mockReturnValue(definitionState({ data: definition, isError: true }) as never);
    renderFilters();

    expect(
      screen.getByText("Filter fields could not be refreshed. Showing the most recent saved definition."),
    ).toBeVisible();
    expect(screen.getByText("No structured filters are applied. Add a rule to narrow the results.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("applies rules managed by the Vireo TanStack form", async () => {
    vi.mocked(useQuery).mockReturnValue(definitionState({ data: definition }) as never);
    const onApply = vi.fn();
    renderFilters(onApply);

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "scanner" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith({
        entity: "ITEM",
        rows: [
          {
            kind: "leaf",
            operator: "CONTAINS",
            parameterized: false,
            path: "name",
            selectedOptions: [],
            value: "scanner",
          },
        ],
      }),
    );
  });

  it("keeps rule validation errors in the Vireo TanStack form", async () => {
    vi.mocked(useQuery).mockReturnValue(definitionState({ data: definition }) as never);
    const onApply = vi.fn();
    renderFilters(onApply);

    fireEvent.click(screen.getByRole("button", { name: "Add filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("Enter a filter value.")).toBeVisible();
    expect(onApply).not.toHaveBeenCalled();
  });
});
