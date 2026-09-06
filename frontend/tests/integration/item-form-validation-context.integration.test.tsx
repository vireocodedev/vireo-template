import { AppStorybookProvider } from "@/app/storybook/AppStorybookProvider";
import { AppFormMode } from "@/app/ui/forms/models/AppFormMode";
import { ItemFormFields } from "@/features/item/components/forms/ItemFormFields/ItemFormFields";
import { type ItemFormApi, useItemForm } from "@/features/item/hooks/useItemForm";
import type { Item } from "@/features/item/models/Item";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const item: Item = {
  id: "00000000-0000-4000-8000-000000000105",
  version: 0,
  name: "Starter audit",
  description: "",
  quantity: 0,
  status: "ACTIVE",
};

let observedForm: ItemFormApi | undefined;

function getObservedForm(): ItemFormApi {
  if (!observedForm) throw new Error("Item form has not rendered.");
  return observedForm;
}

function ContextualItemForm({ nameMinimumLength }: { nameMinimumLength: number }) {
  const form = useItemForm({
    initialValue: item,
    mode: AppFormMode.enum.UPDATE,
    onSubmit: vi.fn(),
    validationContext: { nameMinimumLength },
  });
  observedForm = form;

  return (
    <form.Form>
      <ItemFormFields form={form} mode={AppFormMode.enum.UPDATE} />
      <form.SubmitButton>Submit</form.SubmitButton>
    </form.Form>
  );
}

describe("useItemForm validation context", () => {
  it("does not validate on mount, blur, or context changes before the first submit", async () => {
    observedForm = undefined;
    const view = render(
      <AppStorybookProvider>
        <ContextualItemForm nameMinimumLength={5} />
      </AppStorybookProvider>,
    );
    const name = screen.getByRole("textbox", { name: "Name" });

    fireEvent.change(name, { target: { value: "abc" } });
    fireEvent.blur(name);

    expect(screen.queryByText("Enter at least 5 characters.")).not.toBeInTheDocument();
    expect(name).not.toHaveAttribute("aria-invalid", "true");
    expect(getObservedForm().state.submissionAttempts).toBe(0);

    view.rerender(
      <AppStorybookProvider>
        <ContextualItemForm nameMinimumLength={6} />
      </AppStorybookProvider>,
    );

    await waitFor(() => expect(getObservedForm().state.fieldMeta.name?.isTouched).toBe(true));
    expect(screen.queryByText("Enter at least 6 characters.")).not.toBeInTheDocument();
    expect(name).not.toHaveAttribute("aria-invalid", "true");
    expect(getObservedForm().state.submissionAttempts).toBe(0);
  });

  it("revalidates changed context after the first submit without resetting form state", async () => {
    observedForm = undefined;
    const view = render(
      <AppStorybookProvider>
        <ContextualItemForm nameMinimumLength={2} />
      </AppStorybookProvider>,
    );
    const name = screen.getByRole("textbox", { name: "Name" });

    fireEvent.change(name, { target: { value: "abc" } });
    fireEvent.blur(name);

    await waitFor(() => {
      expect(getObservedForm().state.isDirty).toBe(true);
      expect(getObservedForm().state.fieldMeta.name?.isTouched).toBe(true);
    });
    expect(screen.queryByText("Enter at least 2 characters.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() => expect(getObservedForm().state.submissionAttempts).toBe(1));

    view.rerender(
      <AppStorybookProvider>
        <ContextualItemForm nameMinimumLength={5} />
      </AppStorybookProvider>,
    );

    expect(await screen.findByText("Enter at least 5 characters.")).toBeVisible();
    expect(name).toHaveValue("abc");
    expect(getObservedForm().state.isDirty).toBe(true);
    expect(getObservedForm().state.fieldMeta.name?.isTouched).toBe(true);

    view.rerender(
      <AppStorybookProvider>
        <ContextualItemForm nameMinimumLength={2} />
      </AppStorybookProvider>,
    );

    await waitFor(() => expect(screen.queryByText("Enter at least 5 characters.")).not.toBeInTheDocument());
    expect(name).toHaveValue("abc");
    expect(getObservedForm().state.isDirty).toBe(true);
    expect(getObservedForm().state.fieldMeta.name?.isTouched).toBe(true);
  });
});
