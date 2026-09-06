import { fireEvent, render, screen } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material";
import { PageOverlayControllerProvider } from "@vireocodedev/ui";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { APP_PAGES } from "@/app/app.pages";
import { AppShellNavigationContext } from "@/app/shell/contexts/AppShellNavigationContext";
import { DEFAULT_APP_PREFERENCES } from "@/app/ui/preferences/models/AppPreferences";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import { AppPageNotFound } from "@/pages/not-found/AppPageNotFound";

describe("AppPageNotFound", () => {
  it("renders the unknown path and returns to the overview", async () => {
    sigAppPreferences.value = DEFAULT_APP_PREFERENCES;
    render(
      <ThemeProvider theme={createTheme()}>
        <PageOverlayControllerProvider>
          <AppShellNavigationContext.Provider value={{ mobile: false, openNavigation: vi.fn() }}>
            <MemoryRouter initialEntries={["/missing-page"]}>
              <Routes>
                <Route path={APP_PAGES.home} element={<h1>Overview</h1>} />
                <Route path="*" element={<AppPageNotFound />} />
              </Routes>
            </MemoryRouter>
          </AppShellNavigationContext.Provider>
        </PageOverlayControllerProvider>
      </ThemeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeVisible();
    expect(screen.getByText("No application route matches /missing-page.")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Return to overview" }));

    expect(screen.getByRole("heading", { name: "Overview" })).toBeVisible();
  });
});
