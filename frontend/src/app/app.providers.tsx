import React from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  PageOverlayControllerProvider,
  VireoConfirmationProvider,
  VireoProviderComposer,
  type VireoProviderWrapper,
} from "@vireocodedev/ui";
import { VireoToaster } from "@vireocodedev/ui/sonner";
import { AppLocalizationProvider } from "@/app/ui/localization/app-localization-provider";
import { AppThemeProvider } from "@/app/ui/theme/AppThemeProvider";
import { AppUnsavedChangesProvider } from "@/app/shell/providers/AppUnsavedChangesProvider";
import {
  reportMutationError,
  reportQueryError,
  shouldRetryQueryFailure,
} from "@/app/data/network/services/appQueryErrorReporting";
import { AppAuthProvider } from "@/app/shell/providers/AppAuthProvider";
import { AppPwaProvider } from "@/app/shell/providers/AppPwaProvider";
import { AppOfflineProvider } from "@/app/offline/providers/AppOfflineProvider";

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: reportQueryError }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => reportMutationError(error, mutation),
  }),
  defaultOptions: { queries: { retry: shouldRetryQueryFailure, staleTime: 20_000 } },
});

const providers = [
  child => <AppLocalizationProvider>{child}</AppLocalizationProvider>,
  child => <AppThemeProvider>{child}</AppThemeProvider>,
  child => <QueryClientProvider client={queryClient}>{child}</QueryClientProvider>,
  child => <AppAuthProvider>{child}</AppAuthProvider>,
  child => <AppOfflineProvider>{child}</AppOfflineProvider>,
  child => <PageOverlayControllerProvider>{child}</PageOverlayControllerProvider>,
  child => <VireoConfirmationProvider>{child}</VireoConfirmationProvider>,
  child => <AppUnsavedChangesProvider>{child}</AppUnsavedChangesProvider>,
  child => <AppPwaProvider>{child}</AppPwaProvider>,
] satisfies readonly VireoProviderWrapper[];

export function AppProviders({ children }: React.PropsWithChildren) {
  return (
    <VireoProviderComposer providers={providers}>
      {children}
      <VireoToaster />
    </VireoProviderComposer>
  );
}
