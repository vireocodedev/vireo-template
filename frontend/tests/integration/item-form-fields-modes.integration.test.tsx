import { AppStorybookProvider } from "@/app/storybook/AppStorybookProvider";
import { AppFormMode } from "@/app/ui/forms/models/AppFormMode";
import { ItemFormActions } from "@/features/item/components/forms/ItemFormActions/ItemFormActions";
import { ItemFormFields } from "@/features/item/components/forms/ItemFormFields/ItemFormFields";
import { useItemForm } from "@/features/item/hooks/useItemForm";
import { DEFAULT_ITEM_FORM_VALIDATION_CONTEXT, type Item } from "@/features/item/models/Item";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const item: Item = {
  id: "00000000-0000-4000-8000-000000000104",
  version: 0,
  name: "Starter audit",
  description: "",
  quantity: 0,
  status: "ACTIVE",
};

function ItemFormFieldsFixture({ mode }: { mode: AppFormMode }) {
  const form = useItemForm({
    initialValue: mode === AppFormMode.enum.CREATE ? undefined : item,
    mode,
    onSubmit: vi.fn(),
    validationContext: DEFAULT_ITEM_FORM_VALIDATION_CONTEXT,
  });

  return (
    <form.Form readOnly={mode === AppFormMode.enum.READ} readOnlyEmptyValue="Not provided">
      <ItemFormFields form={form} mode={mode} />
      <ItemFormActions editing={mode === AppFormMode.enum.UPDATE} form={form} onCancel={vi.fn()} />
    </form.Form>
  );
}

function renderMode(mode: AppFormMode) {
  return render(
    <AppStorybookProvider>
      <ItemFormFieldsFixture mode={mode} />
    </AppStorybookProvider>,
  );
}

describe("ItemFormFields mode contract", () => {
  it("renders CREATE as an editable required form and autofocuses the name", () => {
    renderMode(AppFormMode.enum.CREATE);

    expect(screen.queryByText("Item details")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create item" })).toBeVisible();
    expect(screen.getAllByText("*")).toHaveLength(3);
  });

  it("renders UPDATE with canonical values and required markers without autofocus", () => {
    renderMode(AppFormMode.enum.UPDATE);

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Starter audit");
    expect(screen.getByRole("textbox", { name: "Name" })).not.toHaveFocus();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeVisible();
    expect(screen.getAllByText("*")).toHaveLength(3);
  });

  it("renders READ as display values with explicit empty data and no editable or required affordances", () => {
    renderMode(AppFormMode.enum.READ);

    expect(screen.getByText("Starter audit")).toBeVisible();
    expect(screen.getByText("Active")).toBeVisible();
    expect(screen.getByText("0")).toBeVisible();
    expect(screen.getByText("Not provided")).toBeVisible();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.queryByText("*")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});
