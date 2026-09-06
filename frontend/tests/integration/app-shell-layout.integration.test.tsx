import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShellLayout } from "@/app/shell/layout/AppShellLayout";
import { AppPageHeader } from "@/app/shell/layout/AppPageHeader";
import { DEFAULT_APP_PREFERENCES, type AppPreferences } from "@/app/ui/preferences/models/AppPreferences";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import { AppAuthContext } from "@/app/shell/contexts/AppAuthContext";
import { APP_IDENTITY } from "../../pwa-policy.mjs";
import { sigConnectivityStatus } from "@/app/offline/signals/sigConnectivityStatus";
import { ConnectivityStatus } from "@/app/offline/models/AppOffline";

const navigationPropsSpy = vi.hoisted(() => vi.fn());

vi.mock("@vireocodedev/ui", () => ({
  useVireoConfirmation: () => vi.fn(),
  VireoApplicationNavigation: ({
    children,
    mode,
    open,
    variant,
    ...props
  }: {
    children: React.ReactNode | ((state: { mode: "compact" | "expanded"; toggleMode: () => void }) => React.ReactNode);
    mode: "compact" | "expanded";
    open: boolean;
    variant: "permanent" | "temporary";
    [key: string]: unknown;
  }) => {
    navigationPropsSpy({ mode, open, variant, ...props });
    if (variant === "temporary" && !open) return null;
    const resolvedMode = variant === "temporary" ? "expanded" : mode;
    return (
      <aside>
        {typeof children === "function"
          ? children({ mode: resolvedMode, toggleMode: props.onModeChange as () => void })
          : children}
      </aside>
    );
  },
  VireoApplicationNavigationItem: ({
    "aria-label": ariaLabel,
    icon,
    label,
    onClick,
    sx,
  }: {
    "aria-label"?: string;
    icon: React.ReactNode;
    label: string;
    onClick: (event: React.MouseEvent<HTMLElement>) => void;
    sx?: { height?: number; width?: string };
  }) => (
    <button aria-label={ariaLabel} onClick={event => onClick(event)} style={{ height: sx?.height, width: sx?.width }}>
      {icon}
      {label}
    </button>
  ),
  VireoMobileBottomNavigation: ({
    items,
    onChange,
    value,
  }: {
    items: readonly { icon: React.ReactNode; label: string; value: string }[];
    onChange: (value: string, event: React.SyntheticEvent) => void;
    value: string | false;
  }) => (
    <nav aria-label="Quick navigation">
      {items.map(item => (
        <button
          aria-current={item.value === value ? "page" : undefined}
          key={item.value}
          onClick={event => onChange(item.value, event)}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  ),
  VireoPageHeader: ({
    actions,
    leading,
    title,
  }: {
    actions?: React.ReactNode;
    leading?: React.ReactNode;
    title?: React.ReactNode;
  }) => (
    <header>
      {leading}
      {title}
      {actions}
    </header>
  ),
}));

function setDesktop(desktop: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: desktop,
      media: "",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function renderShell(preferenceOverrides: Partial<AppPreferences> = {}) {
  const preferences = { ...DEFAULT_APP_PREFERENCES, ...preferenceOverrides };
  sigAppPreferences.value = preferences;
  return render(
    <ThemeProvider theme={createTheme()}>
      <AppAuthContext.Provider
        value={{
          user: { username: "admin", role: "SUPERADMIN" },
          loading: false,
          expireSession: vi.fn(),
          login: vi.fn(),
          logout: vi.fn().mockResolvedValue(undefined),
        }}
      >
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route element={<AppShellLayout />}>
              <Route index element={<AppPageHeader title="Overview" description="Page description" />} />
              <Route path="settings" element={<p>Offline settings page</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AppAuthContext.Provider>
    </ThemeProvider>,
  );
}

describe("AppShellLayout", () => {
  beforeEach(() => {
    navigationPropsSpy.mockClear();
    sigConnectivityStatus.value = ConnectivityStatus.OFFLINE;
  });

  it("lets unlocked desktop navigation resize independently of the overlay resize preference", async () => {
    setDesktop(true);
    const { container } = renderShell({
      allowSidePanelResize: false,
      navigationLocked: false,
      navigationMode: "compact",
    });

    expect(navigationPropsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ locked: false, resizable: true }));
    expect(navigationPropsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        slotProps: {
          surface: {
            slotProps: { paper: { sx: { bgcolor: "appSurface.content", borderColor: "divider" } } },
          },
        },
      }),
    );
    expect(container.querySelector("[data-app-navigation-header]")).toHaveStyle({
      height: "81px",
      maxHeight: "81px",
      minHeight: "81px",
    });
    expect(container.querySelector("[data-app-navigation-footer]")).toHaveStyle({
      height: "81px",
      maxHeight: "81px",
      minHeight: "81px",
    });
    expect(screen.getByRole("button", { name: "Expand navigation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Items" })).toBeVisible();
    expect(screen.queryByText("V")).not.toBeInTheDocument();

    const accountButton = screen.getByRole("button", { name: "Open account menu" });
    expect(screen.getByText("Account")).toBeVisible();
    expect(accountButton).toHaveStyle({
      height: "64px",
      width: "100%",
    });
    fireEvent.click(accountButton);
    await waitFor(() => expect(screen.getByRole("menu")).toBeVisible());
    expect(screen.getByRole("menu")).toHaveStyle({ marginLeft: "13px" });
    expect(screen.getByText("admin")).toBeVisible();
    expect(screen.getByText("SUPERADMIN")).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  });

  it("keeps the expanded desktop brand header aligned with the page header", () => {
    setDesktop(true);
    const { container } = renderShell({ navigationLocked: false, navigationMode: "expanded" });

    expect(container.querySelector("[data-app-navigation-header]")).toHaveStyle({
      height: "81px",
      maxHeight: "81px",
      minHeight: "81px",
    });
    expect(container.querySelector("[data-app-navigation-footer]")).toHaveStyle({
      height: "81px",
      maxHeight: "81px",
      minHeight: "81px",
    });
    expect(screen.getByText(APP_IDENTITY.name)).toBeVisible();
    expect(screen.getByText("Offline")).toBeVisible();
    expect(screen.getByRole("button", { name: "Compact navigation" })).toBeVisible();
  });

  it("preserves compact navigation while locked and replaces its caret with the logo", () => {
    setDesktop(true);
    renderShell({ navigationLocked: true, navigationMode: "compact" });

    expect(navigationPropsSpy).toHaveBeenLastCalledWith(expect.objectContaining({ locked: true, resizable: false }));
    expect(screen.queryByRole("button", { name: "Expand navigation" })).not.toBeInTheDocument();
    expect(screen.getByText(APP_IDENTITY.shortName.slice(0, 1))).toBeVisible();
  });

  it("provides an explicit close action in full-screen mobile navigation", () => {
    setDesktop(false);
    renderShell();

    expect(screen.getByRole("heading", { name: "Overview" })).toBeVisible();
    expect(screen.queryByText("Page description")).not.toBeInTheDocument();
    expect(screen.queryByText(APP_IDENTITY.name)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close navigation" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("button", { name: "Close navigation" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("button", { name: "Close navigation" })).not.toBeInTheDocument();
  });

  it("shows heartbeat connectivity in expanded navigation", () => {
    sigConnectivityStatus.value = ConnectivityStatus.ONLINE;
    setDesktop(true);
    renderShell({ navigationLocked: false, navigationMode: "expanded" });

    expect(screen.getByText("Online")).toBeVisible();
    expect(screen.getByRole("button", { name: "Online. Open offline settings" })).toBeVisible();
  });

  it("announces changing connectivity and opens Settings from compact navigation", () => {
    setDesktop(true);
    renderShell({ navigationLocked: false, navigationMode: "compact" });

    const offlineControl = screen.getByRole("button", { name: "Offline. Open offline settings" });
    offlineControl.focus();
    expect(offlineControl).toHaveFocus();

    act(() => {
      sigConnectivityStatus.value = ConnectivityStatus.ONLINE;
    });
    const onlineControl = screen.getByRole("button", { name: "Online. Open offline settings" });
    fireEvent.click(onlineControl);

    expect(screen.getByText("Offline settings page")).toBeVisible();
  });
});
