import { AppStorybookProvider } from "@/app/storybook/AppStorybookProvider";
import { ItemHistoryOverlay } from "@/features/item/components/overlays/ItemHistoryOverlay";
import { useItemHistory } from "@/features/item/hooks/useItemHistory";
import { ItemHistoryRecordSchema } from "@/features/item/models/ItemHistory";
import type { Item } from "@/features/item/models/Item";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/item/hooks/useItemHistory", () => ({ useItemHistory: vi.fn() }));

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
  id: "00000000-0000-4000-8000-000000000103",
  version: 0,
  name: "Starter audit",
  description: "",
  quantity: 2,
  status: "ACTIVE",
};
const record = ItemHistoryRecordSchema.parse({
  id: "3d16bc25-0fde-44a6-91fd-e84a3f64323d",
  timestamp: "2026-08-24T18:30:00Z",
  actor: { id: "admin", label: "Admin" },
  entity: "ITEM",
  entityId: item.id,
  snapshotPrevious: { ...item, description: null, quantity: 1, status: "DRAFT" },
  snapshotCurrent: item,
});

const refetch = vi.fn(async () => undefined);

function historyState(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isError: false,
    isFetching: false,
    isPending: false,
    refetch,
    ...overrides,
  } as unknown as ReturnType<typeof useItemHistory>;
}

function renderHistory() {
  return render(
    <AppStorybookProvider>
      <ItemHistoryOverlay item={item} open onClose={vi.fn()} />
    </AppStorybookProvider>,
  );
}

describe("Item history overlay loading-state contract", () => {
  beforeEach(() => {
    refetch.mockClear();
  });

  it("keeps the overlay frame and one busy boundary around the real entry skeleton", async () => {
    vi.mocked(useItemHistory).mockReturnValue(historyState({ isFetching: true, isPending: true }));
    renderHistory();

    expect(screen.getByText("History · Starter audit")).toBeVisible();
    expect(screen.getByText("Recorded changes are shown in chronological order.")).toBeVisible();
    expect(document.querySelector(".VireoHistoryEntry-loading")).not.toBeNull();
    expect(document.querySelectorAll("[data-history-entry-loading-row]")).toHaveLength(2);
    expect(document.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Loading item history");
  });

  it("retains usable history and shows subtle progress while refreshing", async () => {
    vi.mocked(useItemHistory).mockReturnValue(historyState({ data: [record], isFetching: true }));
    renderHistory();

    expect(screen.getByText("Quantity")).toBeVisible();
    expect(document.querySelector(".VireoHistoryEntry-loading")).toBeNull();
    expect(document.querySelector('time[datetime="2026-08-24T18:30:00.000Z"]')).not.toBeNull();
    expect(document.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Loading item history");
    expect(screen.getByRole("progressbar", { hidden: true })).toHaveAttribute("aria-hidden", "true");
  });

  it("renders recoverable initial and retained-data errors exclusively", () => {
    vi.mocked(useItemHistory).mockReturnValue(historyState({ isError: true }));
    const initialError = renderHistory();

    expect(screen.getByText("Item history could not be loaded.")).toBeVisible();
    expect(screen.queryByText("Quantity")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
    initialError.unmount();

    vi.mocked(useItemHistory).mockReturnValue(historyState({ data: [record], isError: true }));
    renderHistory();

    expect(screen.getByText("History could not be refreshed. Showing the most recent saved copy.")).toBeVisible();
    expect(screen.getByText("Quantity")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("renders the stable empty state without loading or error content", () => {
    vi.mocked(useItemHistory).mockReturnValue(historyState({ data: [] }));
    renderHistory();

    expect(screen.getByText("No history has been recorded for this item.")).toBeVisible();
    expect(document.querySelector(".VireoHistoryEntry-loading")).toBeNull();
    expect(screen.queryByText("Item history could not be loaded.")).not.toBeInTheDocument();
  });
});
