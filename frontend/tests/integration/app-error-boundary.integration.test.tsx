import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { AppErrorBoundary } from "@/app/shell/components/AppErrorBoundary";
import {
  APP_ERROR_BOUNDARY_FALLBACK_COPY,
  resolveAppErrorBoundaryCopy,
} from "@/app/shell/services/app-error-boundary-copy";
import { appI18n } from "@/app/ui/localization/app-i18n";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(async () => {
  await appI18n.changeLanguage("en");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AppErrorBoundary", () => {
  it("reports render failures, hides error details, and recovers on retry", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reportError = vi.fn();
    let shouldThrow = true;

    function UnstablePage() {
      if (shouldThrow) throw new Error("private customer record 42");
      return <p>Page recovered</p>;
    }

    render(
      <AppErrorBoundary onError={reportError} scope="route">
        <UnstablePage />
      </AppErrorBoundary>,
    );

    const heading = screen.getByRole("heading", { name: "Something went wrong" });
    expect(heading).toHaveFocus();
    expect(screen.queryByText(/private customer record/i)).not.toBeInTheDocument();
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(Error),
        scope: "route",
      }),
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByText("Page recovered")).toBeVisible();
  });

  it("catches rejected lazy modules and exposes every configured recovery action", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const goHome = vi.fn();
    const reload = vi.fn();
    const logout = vi.fn();
    const reportError = vi.fn();
    const BrokenLazyPage = React.lazy(() => Promise.reject(new Error("private chunk URL")));

    render(
      <AppErrorBoundary onError={reportError} onHome={goHome} onLogout={logout} onReload={reload} scope="root">
        <React.Suspense fallback={<p>Loading page</p>}>
          <BrokenLazyPage />
        </React.Suspense>
      </AppErrorBoundary>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("This page could not be displayed");
    expect(screen.queryByText(/private chunk URL/i)).not.toBeInTheDocument();
    expect(reportError).toHaveBeenCalledWith(expect.objectContaining({ scope: "root" }));

    fireEvent.click(screen.getByRole("button", { name: "Go home" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload application" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(goHome).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(logout).toHaveBeenCalledOnce();
  });

  it("uses Croatian recovery copy when localization is ready", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await appI18n.changeLanguage("hr");

    function BrokenPage(): React.ReactNode {
      throw new Error("private diagnostic");
    }

    render(
      <AppErrorBoundary scope="route">
        <BrokenPage />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "Došlo je do pogreške" })).toBeVisible();
    expect(screen.getByRole("group", { name: "Radnje za oporavak aplikacije" })).toBeVisible();
    expect(screen.queryByText(/private diagnostic/u)).not.toBeInTheDocument();
  });

  it("keeps safe English recovery copy available before localization initializes", () => {
    expect(resolveAppErrorBoundaryCopy(false)).toEqual(APP_ERROR_BOUNDARY_FALLBACK_COPY);
  });
});
