import React from "react";
import { AppAuthContext } from "@/app/shell/contexts/AppAuthContext";
import { AppStorybookProvider } from "@/app/storybook/AppStorybookProvider";
import { AppFormMode } from "@/app/ui/forms/models/AppFormMode";
import { ItemFormActions } from "@/features/item/components/forms/ItemFormActions/ItemFormActions";
import { ItemFormFields } from "@/features/item/components/forms/ItemFormFields/ItemFormFields";
import { useItemForm } from "@/features/item/hooks/useItemForm";
import { DEFAULT_ITEM_FORM_VALIDATION_CONTEXT, type Item } from "@/features/item/models/Item";
import { AppPageLogin } from "@/pages/login/AppPageLogin";
import { AppPageSettings } from "@/pages/settings/AppPageSettings";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const item: Item = {
  id: "00000000-0000-4000-8000-000000000101",
  version: 0,
  name: "Starter audit",
  description: "Verify pending action behavior.",
  quantity: 2,
  status: "ACTIVE",
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function ItemFormHarness({
  onSubmit,
  submissionDisabled = false,
}: {
  onSubmit: (value: Item) => Promise<void>;
  submissionDisabled?: boolean;
}) {
  const [pending, setPending] = React.useState(false);
  const form = useItemForm({
    initialValue: item,
    mode: AppFormMode.enum.UPDATE,
    onSubmit: async value => {
      setPending(true);
      try {
        await onSubmit(value);
      } finally {
        setPending(false);
      }
    },
    validationContext: DEFAULT_ITEM_FORM_VALIDATION_CONTEXT,
  });

  return (
    <form.Form layoutWidth="full">
      <ItemFormFields form={form} mode={AppFormMode.enum.UPDATE} />
      <ItemFormActions
        editing
        form={form}
        onCancel={vi.fn()}
        pending={pending}
        submissionDisabled={submissionDisabled}
      />
    </form.Form>
  );
}

describe("busy action loading-state contract", () => {
  it("retains the item form and locks save and cancel while a mutation is pending", async () => {
    const submission = deferred<void>();
    const onSubmit = vi.fn(() => submission.promise);

    render(
      <AppStorybookProvider>
        <ItemFormHarness onSubmit={onSubmit} />
      </AppStorybookProvider>,
    );

    const save = screen.getByRole("button", { name: "Save changes" });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(save);

    await waitFor(() => {
      expect(save).toBeDisabled();
      expect(cancel).toBeDisabled();
    });
    expect(screen.getByDisplayValue("Starter audit")).toBeVisible();
    expect(onSubmit).toHaveBeenCalledOnce();

    fireEvent.click(save);
    expect(onSubmit).toHaveBeenCalledOnce();

    await act(async () => submission.resolve());
    await waitFor(() => {
      expect(save).toBeEnabled();
      expect(cancel).toBeEnabled();
    });
  });

  it("preserves an editable draft but disables submission during offline recovery", () => {
    render(
      <AppStorybookProvider>
        <ItemFormHarness onSubmit={vi.fn().mockResolvedValue(undefined)} submissionDisabled />
      </AppStorybookProvider>,
    );

    const name = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "Draft preserved during recovery" } });

    expect(name).toHaveValue("Draft preserved during recovery");
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("retains the login card, prevents duplicate submission, and recovers after failure", async () => {
    const submission = deferred<void>();
    const login = vi.fn(() => submission.promise);

    render(
      <AppStorybookProvider initialEntries={["/login"]}>
        <AppAuthContext.Provider
          value={{
            user: null,
            loading: false,
            expireSession: vi.fn(),
            login,
            logout: vi.fn().mockResolvedValue(undefined),
          }}
        >
          <AppPageLogin />
        </AppAuthContext.Provider>
      </AppStorybookProvider>,
    );

    const username = screen.getByRole("textbox", { name: "Username" });
    const password = screen.getByLabelText("Password");
    fireEvent.change(username, { target: { value: "admin" } });
    fireEvent.change(password, { target: { value: "admin123" } });

    const submit = screen.getByRole("button", { name: "Sign in" });
    fireEvent.click(submit);

    await waitFor(() => expect(submit).toBeDisabled());
    expect(screen.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(username).toHaveValue("admin");
    expect(password).toHaveValue("admin123");
    expect(login).toHaveBeenCalledOnce();

    fireEvent.click(submit);
    expect(login).toHaveBeenCalledOnce();

    await act(async () => submission.reject(new Error("Invalid credentials")));
    expect(await screen.findByText("The sign-in service is temporarily unavailable. Try again later.")).toBeVisible();
    await waitFor(() => expect(submit).toBeEnabled());
  });

  it("permits one offline maintenance action and recovers after rejection", async () => {
    const reset = deferred<void>();
    const resetOfflineCache = vi.fn(() => reset.promise);

    render(
      <AppStorybookProvider initialEntries={["/settings"]}>
        <AppPageSettings
          offlineOperations={{
            discard: vi.fn().mockResolvedValue(undefined),
            reset: resetOfflineCache,
            retry: vi.fn().mockResolvedValue(undefined),
          }}
        />
      </AppStorybookProvider>,
    );

    const resetButton = screen.getByRole("button", { name: "Reset cache" });
    fireEvent.click(resetButton);

    await waitFor(() => expect(resetButton).toBeDisabled());
    expect(resetButton).toHaveAttribute("aria-busy", "true");
    fireEvent.click(resetButton);
    expect(resetOfflineCache).toHaveBeenCalledOnce();

    await act(async () => reset.reject(new Error("Storage unavailable")));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The offline action could not be completed: Storage unavailable",
    );
    await waitFor(() => expect(resetButton).toBeEnabled());
    expect(resetButton).toHaveAttribute("aria-busy", "false");
  });
});
