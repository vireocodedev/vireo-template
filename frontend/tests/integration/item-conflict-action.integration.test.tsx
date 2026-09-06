import { AppStorybookProvider } from "@/app/storybook/AppStorybookProvider";
import { useItemTableColumns } from "@/features/item/hooks/useItemTableColumns";
import type { Item } from "@/features/item/models/Item";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const conflictedItem = Object.assign(
  {
    id: "00000000-0000-4000-8000-000000000522",
    version: 2,
    name: "Conflicted deletion",
    description: "",
    quantity: 1,
    status: "ACTIVE",
  } satisfies Item,
  { conflict: true },
);

function ConflictActions({ onResolve }: { onResolve: (item: Item) => void }) {
  const actions = useItemTableColumns({ onResolveConflict: onResolve }).find(column => column.id === "actions");
  if (!actions) throw new Error("Expected Item actions column.");
  return <>{actions.renderBody(conflictedItem, 0, { placement: "desktop" })}</>;
}

describe("Item conflict action", () => {
  it("routes a visible conflicted Item to centralized synchronization controls", () => {
    const onResolve = vi.fn();
    render(
      <AppStorybookProvider>
        <ConflictActions onResolve={onResolve} />
      </AppStorybookProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resolve sync conflict for Conflicted deletion" }));

    expect(onResolve).toHaveBeenCalledWith(conflictedItem);
  });
});
