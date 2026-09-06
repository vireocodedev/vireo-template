import React from "react";
import { useMediaQuery, useTheme } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { PageOverlayControllerProvider, VireoConfirmationProvider } from "@vireocodedev/ui";
import { AppShellNavigationContext } from "@/app/shell/contexts/AppShellNavigationContext";
import { AppUnsavedChangesProvider } from "@/app/shell/providers/AppUnsavedChangesProvider";
import { AppLocalizationProvider } from "@/app/ui/localization/app-localization-provider";
import { AppThemeProvider } from "@/app/ui/theme/AppThemeProvider";

export type AppStorybookProviderProps = React.PropsWithChildren<{
  initialEntries?: string[];
  mobile?: boolean;
}>;

type AppStorybookShellProviderProps = React.PropsWithChildren<{
  mobile?: boolean;
}>;

function AppStorybookShellProvider({ children, mobile: mobileOverride }: AppStorybookShellProviderProps) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const mobile = mobileOverride ?? !desktop;
  const navigation = React.useMemo(() => ({ mobile, openNavigation: () => undefined }), [mobile]);

  return <AppShellNavigationContext.Provider value={navigation}>{children}</AppShellNavigationContext.Provider>;
}

export function AppStorybookProvider({ children, initialEntries = ["/"], mobile }: AppStorybookProviderProps) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          mutations: { retry: false },
          queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
        },
      }),
  );

  return (
    <AppLocalizationProvider>
      <AppThemeProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={initialEntries}>
            <AppStorybookShellProvider mobile={mobile}>
              <PageOverlayControllerProvider>
                <VireoConfirmationProvider>
                  <AppUnsavedChangesProvider>{children}</AppUnsavedChangesProvider>
                </VireoConfirmationProvider>
              </PageOverlayControllerProvider>
            </AppStorybookShellProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </AppThemeProvider>
    </AppLocalizationProvider>
  );
}
