import React from "react";
import { Snackbar } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { appSessionExpiry } from "@/app/data/network/services/appSessionExpiry";
import { appAuthApi } from "@/app/data/network/api/app-auth.api.online";
import { type AppAuthFailure, toAppAuthFailureError } from "@/app/data/network/models/AppAuthFailure";
import type { AuthUser } from "@/app/data/network/models/AuthUser";
import { AppAuthFailureAlert } from "@/app/shell/components/AppAuthFailureAlert";
import { AppAuthContext, type AppAuthContextValue } from "../contexts/AppAuthContext";
import { appConfig } from "@/app/config/app-config";
import { resetAppHeartbeat } from "@/app/offline/services/app-offline-heartbeat";

const loadOfflineAdapter = () => import("@/app/adapters/app-offline.adapter");

async function prepareAuthenticatedOfflineCapability(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  try {
    const offlineAdapter = await loadOfflineAdapter();
    await offlineAdapter.validateLiveOfflineCurrentUser();
    offlineAdapter.installOfflineItemAdapter();
  } catch (error) {
    queryClient.clear();
    try {
      (await loadOfflineAdapter()).markOfflineCacheUnavailable(error);
    } catch {
      // Offline support is optional while the authenticated online session remains usable.
    }
  }
}

async function loadCachedOfflineUser(): Promise<AuthUser | null> {
  try {
    const offlineAdapter = await loadOfflineAdapter();
    offlineAdapter.installOfflineItemAdapter();
    const cachedUser = await offlineAdapter.validateOfflineCurrentUser();
    return cachedUser ? { username: cachedUser.username, role: cachedUser.role } : null;
  } catch {
    return null;
  }
}

async function clearOfflineCapability(purgeData: boolean): Promise<void> {
  try {
    const offlineAdapter = await loadOfflineAdapter();
    if (purgeData) {
      try {
        await offlineAdapter.purgeOfflineData();
      } catch (error) {
        offlineAdapter.markOfflineCacheUnavailable(error);
      }
    }
    offlineAdapter.clearOfflineCurrentUser();
  } catch {
    // Offline support must not turn a successful server logout into a failure.
  }
}

export function AppAuthProvider({ children }: React.PropsWithChildren) {
  const queryClient = useQueryClient();
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [failure, setFailure] = React.useState<AppAuthFailure | null>(null);
  const userIdentity = React.useRef<string | null>(null);
  const setAuthenticatedUser = React.useCallback((nextUser: AuthUser | null) => {
    const nextIdentity = nextUser?.username ?? null;
    if (nextIdentity !== userIdentity.current) resetAppHeartbeat();
    userIdentity.current = nextIdentity;
    setUser(nextUser);
  }, []);

  React.useEffect(() => {
    void appAuthApi
      .me()
      .then(async authenticatedUser => {
        if (appConfig.apiMode === "http") await prepareAuthenticatedOfflineCapability(queryClient);
        appSessionExpiry.reset();
        setFailure(null);
        setAuthenticatedUser(authenticatedUser);
      })
      .catch(async error => {
        const authError = toAppAuthFailureError(error, "bootstrap");
        const cachedUser = authError.failure.kind === "offline" ? await loadCachedOfflineUser() : null;
        if (cachedUser) {
          setFailure(null);
          setAuthenticatedUser(cachedUser);
          return;
        }
        setFailure(authError.failure);
        if (authError.failure.kind === "unauthenticated") setAuthenticatedUser(null);
      })
      .finally(() => setLoading(false));
  }, [queryClient, setAuthenticatedUser]);

  const value = React.useMemo<AppAuthContextValue>(
    () => ({
      user,
      loading,
      failure,
      expireSession: () => {
        queryClient.clear();
        setFailure({ kind: "expired-session" });
        setAuthenticatedUser(null);
      },
      login: async (username, password) => {
        setFailure(null);
        try {
          await appAuthApi.login(username, password);
        } catch (error) {
          const authError = toAppAuthFailureError(error, "login");
          setFailure(authError.failure);
          throw authError;
        }

        try {
          const authenticatedUser = await appAuthApi.me();
          if (appConfig.apiMode === "http") await prepareAuthenticatedOfflineCapability(queryClient);
          appSessionExpiry.reset();
          setAuthenticatedUser(authenticatedUser);
        } catch (error) {
          const authError = toAppAuthFailureError(error, "session");
          setFailure(authError.failure);
          throw authError;
        }
      },
      logout: async () => {
        appSessionExpiry.beginManualLogout();
        setFailure(null);
        try {
          await appAuthApi.logout();
          await clearOfflineCapability(appConfig.apiMode === "http");
          queryClient.clear();
          setAuthenticatedUser(null);
        } catch (error) {
          appSessionExpiry.cancelManualLogout();
          const authError = toAppAuthFailureError(error, "logout");
          setFailure(authError.failure);
          throw authError;
        }
      },
    }),
    [failure, loading, queryClient, setAuthenticatedUser, user],
  );

  return (
    <AppAuthContext.Provider value={value}>
      {children}
      <Snackbar anchorOrigin={{ horizontal: "center", vertical: "top" }} open={failure?.kind === "logout-failure"}>
        <AppAuthFailureAlert failure={{ kind: "logout-failure" }} onClose={() => setFailure(null)} variant="filled" />
      </Snackbar>
    </AppAuthContext.Provider>
  );
}
