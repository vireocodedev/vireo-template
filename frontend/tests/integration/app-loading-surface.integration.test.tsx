import { APP_PAGE_REGISTRY, type AppRouteLoadingPolicy } from "@/app/app.pages";
import { AppRouteFallback } from "@/app/shell/components/AppLoadingSurface";
import { AppShellNavigationContext } from "@/app/shell/contexts/AppShellNavigationContext";
import { DEFAULT_APP_PREFERENCES } from "@/app/ui/preferences/models/AppPreferences";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import { createTheme, ThemeProvider } from "@mui/material";
import { PageOverlayControllerProvider } from "@vireocodedev/ui";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

function renderFallback(loading: AppRouteLoadingPolicy, pageWidth: "md" | "lg" | "xl" | "full" = "md") {
  sigAppPreferences.value = { ...DEFAULT_APP_PREFERENCES, pageWidth };
  return render(
    <ThemeProvider theme={createTheme()}>
      <MemoryRouter>
        <AppShellNavigationContext.Provider value={{ mobile: false, openNavigation: vi.fn() }}>
          <PageOverlayControllerProvider>
            <AppRouteFallback loading={loading} />
          </PageOverlayControllerProvider>
        </AppShellNavigationContext.Provider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("AppRouteFallback", () => {
  it("keeps the exact Overview composition available as a reference skeleton", async () => {
    const view = renderFallback({ policy: "skeleton", composition: "overview" });

    expect(await screen.findByRole("status")).toHaveTextContent("Loading page");
    expect(view.container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
    expect(view.container.querySelector("header")).not.toBeNull();
    expect(view.container.querySelector(".MuiContainer-maxWidthMd")).not.toBeNull();
    expect(view.container.querySelector('[data-app-route-fallback-variant="overview"]')).not.toBeNull();
    expect(view.container.querySelector('[data-app-overview-loading-phase="visible"]')).not.toBeNull();
  });

  it("uses a progress-only page region with the real localized header and width constraint", async () => {
    const view = renderFallback(APP_PAGE_REGISTRY.items.loading, "lg");

    expect(screen.getByRole("heading", { name: "Items" })).toBeVisible();
    expect(screen.getByText("A complete responsive CRUD workflow backed by one Starter entity.")).toBeVisible();
    expect(view.container.querySelector(".MuiContainer-maxWidthLg")).not.toBeNull();
    expect(view.container.querySelector(".MuiSkeleton-root")).toBeNull();
    expect(await screen.findByRole("status")).toHaveTextContent("Loading page");
    expect(view.container.querySelectorAll('[aria-busy="true"]')).toHaveLength(1);
  });

  it("renders no replacement surface for retain and none policies", () => {
    const retained = renderFallback({ policy: "retain" });
    expect(retained.container).toBeEmptyDOMElement();
    retained.unmount();

    const none = renderFallback({ policy: "none" });
    expect(none.container).toBeEmptyDOMElement();
  });
});
