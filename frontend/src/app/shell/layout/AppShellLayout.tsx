import React from "react";
import {
  AccountCircleRounded,
  ChevronLeftRounded,
  ChevronRightRounded,
  CloseRounded,
  DashboardOutlined,
  Inventory2Outlined,
  ExtensionOutlined,
  LogoutOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import {
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  Popover,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  VireoApplicationNavigation,
  VireoApplicationNavigationItem,
  VireoMobileBottomNavigation,
  useVireoConfirmation,
  type VireoApplicationNavigationMode,
} from "@vireocodedev/ui";
import { Outlet, useLocation, useNavigate } from "react-router";
import { APP_NAVIGATION_PAGES, APP_PAGES, preloadAppPage, type AppNavigationIcon } from "@/app/app.pages";
import { AppShellNavigationContext } from "@/app/shell/contexts/AppShellNavigationContext";
import { updateAppPreference } from "@/app/ui/preferences/actions/app-preferences-actions";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import { useAppAuth } from "@/app/shell/hooks/useAppAuth";
import { isAppRouteActive } from "@/app/shell/routing/isAppRouteActive";
import { useAppTranslation } from "@/app/ui/localization/use-app-translation";
import { APP_THEME_TOKENS } from "@/app/ui/theme/config/theme.tokens";
import { appConfig } from "@/app/config/app-config";
import { sigConnectivityStatus } from "@/app/offline/signals/sigConnectivityStatus";
import { sigSyncSummary } from "@/app/offline/signals/sigSyncSummary";
import { ConnectivityStatus, SyncStatus } from "@/app/offline/models/AppOffline";

const navigationIcons: Record<AppNavigationIcon, React.ReactNode> = {
  OVERVIEW: <DashboardOutlined />,
  ITEMS: <Inventory2Outlined />,
  SETTINGS: <SettingsOutlined />,
  GENERATED: <ExtensionOutlined />,
};

export function AppShellLayout() {
  const { t } = useAppTranslation();
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [accountAnchor, setAccountAnchor] = React.useState<HTMLElement | null>(null);
  const { user, logout } = useAppAuth();
  const preferences = sigAppPreferences.value;
  const location = useLocation();
  const navigate = useNavigate();
  const confirm = useVireoConfirmation();
  const connectivity = sigConnectivityStatus.value;
  const sync = sigSyncSummary.value;
  const connectivityLabel = t(`offline.${connectivity}`);
  const connectivityActionLabel = t("offline.OPEN_SETTINGS_WITH_STATUS", { status: connectivityLabel });
  const syncLabel =
    sync.failed > 0
      ? t("offline.FAILED", { count: sync.failed })
      : sync.status === SyncStatus.SYNCING
        ? t("offline.SYNCING")
        : sync.pending > 0
          ? t("offline.PENDING", { count: sync.pending })
          : null;
  const navigation = React.useMemo(
    () =>
      APP_NAVIGATION_PAGES.map(item => ({
        ...item,
        icon: navigationIcons[item.icon],
        label: "labels" in item ? item.labels[preferences.locale] : t(`navigation.${item.labelKey}`),
      })),
    [preferences.locale, t],
  );
  const mobileNavigationItems = React.useMemo(
    () => navigation.map(item => ({ icon: item.icon, label: item.label, value: item.path })),
    [navigation],
  );
  const activeNavigationPath = navigation.find(item => isAppRouteActive(location.pathname, item.path))?.path ?? false;

  const commitNavigationWidth = React.useCallback((width: number) => updateAppPreference("navigationWidth", width), []);
  const commitNavigationMode = React.useCallback(
    (mode: VireoApplicationNavigationMode) => updateAppPreference("navigationMode", mode),
    [],
  );

  const navigateTo = React.useCallback(
    (path: string) => {
      preloadAppPage(path);
      void navigate(path, { viewTransition: true });
      setMobileOpen(false);
      setAccountAnchor(null);
    },
    [navigate],
  );

  const closeMobileNavigation = React.useCallback(() => {
    setMobileOpen(false);
    setAccountAnchor(null);
  }, []);

  const shellNavigation = React.useMemo(
    () => ({ mobile: !desktop, openNavigation: () => setMobileOpen(true) }),
    [desktop],
  );

  const signOut = React.useCallback(async () => {
    setAccountAnchor(null);
    const performLogout = () => logout().then(() => navigate(APP_PAGES.login));
    if (sync.pending + sync.failed === 0) {
      await performLogout();
      return;
    }
    await confirm({
      title: t("account.SIGN_OUT_PENDING_TITLE"),
      message: <>{t("account.SIGN_OUT_PENDING_MESSAGE", { count: sync.pending + sync.failed })}</>,
      confirmLabel: t("account.SIGN_OUT"),
      confirmColor: "error",
      onConfirm: performLogout,
    });
  }, [confirm, logout, navigate, sync.failed, sync.pending, t]);

  return (
    <Box sx={{ display: "flex", height: "100dvh", minHeight: 0, overflow: "hidden" }}>
      <VireoApplicationNavigation
        navigationLabel={t("navigation.PRIMARY")}
        variant={desktop ? "permanent" : "temporary"}
        open={mobileOpen}
        onClose={closeMobileNavigation}
        mode={preferences.navigationMode}
        expandedWidth={preferences.navigationWidth}
        locked={preferences.navigationLocked}
        resizable={desktop && !preferences.navigationLocked}
        onModeChange={commitNavigationMode}
        onExpandedWidthChange={commitNavigationWidth}
        slotProps={{
          surface: {
            slotProps: {
              paper: { sx: { bgcolor: "appSurface.content", borderColor: "divider" } },
            },
          },
        }}
      >
        {({ mode, toggleMode }) => {
          const compact = mode === "compact";
          const showBrandMark = !desktop || !compact || preferences.navigationLocked;

          return (
            <>
              <Box
                data-app-navigation-header
                sx={{
                  bgcolor: "appSurface.chrome",
                  display: "flex",
                  flexDirection: "column",
                  flexShrink: 0,
                  ...(desktop && {
                    height: APP_THEME_TOKENS.layout.headerHeight.desktop,
                    maxHeight: APP_THEME_TOKENS.layout.headerHeight.desktop,
                    minHeight: APP_THEME_TOKENS.layout.headerHeight.desktop,
                  }),
                }}
              >
                <Box
                  sx={{
                    alignItems: "center",
                    boxSizing: "border-box",
                    display: "flex",
                    flex: desktop ? "1 1 0" : undefined,
                    flexDirection: "row",
                    gap: 1.5,
                    justifyContent: compact ? "center" : "flex-start",
                    minHeight: desktop ? 0 : compact ? 72 : 89,
                    px: compact ? 1 : 2.25,
                    py: compact ? 1 : 2.5,
                  }}
                >
                  {showBrandMark && (
                    <Avatar
                      variant="rounded"
                      sx={{
                        bgcolor: "primary.main",
                        borderColor: "primary.light",
                        borderStyle: "solid",
                        borderWidth: 1,
                        borderRadius: 1,
                        boxShadow: theme =>
                          `inset 0 1px 0 color-mix(in srgb, ${theme.palette.common.white} 30%, transparent), 0 4px 12px color-mix(in srgb, ${theme.palette.primary.main} 24%, transparent)`,
                        color: "primary.contrastText",
                        flex: "0 0 auto",
                        fontWeight: 900,
                      }}
                    >
                      {appConfig.identity.shortName.slice(0, 1)}
                    </Avatar>
                  )}
                  {!compact && (
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                        {appConfig.name}
                      </Typography>
                    </Box>
                  )}
                  {desktop && !preferences.navigationLocked && (
                    <Tooltip title={compact ? t("navigation.EXPAND") : t("navigation.COMPACT")}>
                      <IconButton
                        aria-label={compact ? t("navigation.EXPAND") : t("navigation.COMPACT")}
                        onClick={toggleMode}
                        size="small"
                      >
                        {compact ? <ChevronRightRounded /> : <ChevronLeftRounded />}
                      </IconButton>
                    </Tooltip>
                  )}
                  {!desktop && (
                    <Tooltip title={t("navigation.CLOSE")}>
                      <IconButton
                        aria-label={t("navigation.CLOSE")}
                        onClick={closeMobileNavigation}
                        size="small"
                        sx={{ ml: "auto" }}
                      >
                        <CloseRounded />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <Divider sx={{ flexShrink: 0 }} />
              </Box>
              <List
                aria-label={t("navigation.PRIMARY")}
                component="nav"
                sx={{ flex: 1, px: compact ? 0.75 : 1.25, py: 1.5 }}
              >
                {navigation.map(item => (
                  <VireoApplicationNavigationItem
                    key={item.path}
                    href={item.path}
                    icon={item.icon}
                    label={item.label}
                    selected={isAppRouteActive(location.pathname, item.path)}
                    onClick={event => {
                      event.preventDefault();
                      navigateTo(item.path);
                    }}
                    onFocus={() => preloadAppPage(item.path)}
                    onPointerEnter={() => preloadAppPage(item.path)}
                    sx={{ mb: 0.5 }}
                  />
                ))}
              </List>
              <Box sx={{ bgcolor: "appSurface.chrome", flexShrink: 0, px: compact ? 0.75 : 1.25, py: 1 }}>
                <Tooltip title={connectivityActionLabel}>
                  <Button
                    aria-label={connectivityActionLabel}
                    color="inherit"
                    fullWidth
                    onClick={() => navigateTo(`${APP_PAGES.settings}#offline`)}
                    sx={{
                      justifyContent: compact ? "center" : "flex-start",
                      minWidth: 0,
                      px: compact ? 0.75 : 1,
                      "& .MuiButton-startIcon": { mr: compact ? 0 : 0.75 },
                    }}
                    startIcon={
                      <Badge
                        badgeContent={compact ? sync.pending + sync.failed : 0}
                        color={sync.failed > 0 ? "error" : "primary"}
                        max={99}
                      >
                        <Box
                          aria-hidden
                          sx={{
                            bgcolor: connectivity === ConnectivityStatus.ONLINE ? "success.main" : "warning.main",
                            borderRadius: "50%",
                            height: 8,
                            width: 8,
                          }}
                        />
                      </Badge>
                    }
                  >
                    {!compact && `${connectivityLabel}${syncLabel ? ` · ${syncLabel}` : ""}`}
                  </Button>
                </Tooltip>
              </Box>
              <Divider sx={{ flexShrink: 0 }} />
              <Box
                data-app-navigation-footer
                sx={{
                  bgcolor: "appSurface.chrome",
                  display: "flex",
                  flexDirection: "column",
                  flexShrink: 0,
                  ...(desktop && {
                    height: APP_THEME_TOKENS.layout.footerHeight.desktop,
                    maxHeight: APP_THEME_TOKENS.layout.footerHeight.desktop,
                    minHeight: APP_THEME_TOKENS.layout.footerHeight.desktop,
                  }),
                }}
              >
                {compact ? (
                  <Box
                    sx={{
                      alignItems: "center",
                      display: "flex",
                      flex: desktop ? "1 1 0" : undefined,
                      justifyContent: "center",
                      minHeight: desktop ? 0 : undefined,
                      px: 0.75,
                      py: 1,
                    }}
                  >
                    <Tooltip title={t("account.OPEN_MENU")}>
                      <Button
                        aria-controls={accountAnchor ? "app-account-menu" : undefined}
                        aria-expanded={accountAnchor ? true : undefined}
                        aria-haspopup="menu"
                        aria-label={t("account.OPEN_MENU")}
                        color="inherit"
                        onClick={event => setAccountAnchor(event.currentTarget)}
                        startIcon={<AccountCircleRounded />}
                        sx={{
                          borderRadius: 1,
                          flexDirection: "column",
                          fontSize: "0.625rem",
                          gap: 0.25,
                          height: 64,
                          minWidth: 0,
                          width: "100%",
                          "& .MuiButton-startIcon": { m: 0 },
                        }}
                      >
                        {t("account.LABEL")}
                      </Button>
                    </Tooltip>
                    <Popover
                      id="app-account-menu"
                      anchorEl={accountAnchor}
                      anchorOrigin={{ horizontal: "right", vertical: "center" }}
                      onClose={() => setAccountAnchor(null)}
                      open={Boolean(accountAnchor)}
                      transformOrigin={{ horizontal: "left", vertical: "center" }}
                      slotProps={{
                        paper: {
                          role: "menu",
                          sx: { ml: "13px", minWidth: 240, p: 1 },
                        },
                      }}
                    >
                      <Box sx={{ alignItems: "center", display: "flex", gap: 1.25, p: 1 }}>
                        <Avatar sx={{ height: 36, width: 36 }}>{user?.username.slice(0, 1).toUpperCase()}</Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap variant="body2" sx={{ fontWeight: 700 }}>
                            {user?.username}
                          </Typography>
                          <Typography color="text.secondary" variant="caption">
                            {user?.role}
                          </Typography>
                        </Box>
                      </Box>
                      <Divider />
                      <Button
                        color="inherit"
                        fullWidth
                        onClick={() => void signOut()}
                        role="menuitem"
                        startIcon={<LogoutOutlined />}
                        sx={{ justifyContent: "flex-start", mt: 0.5 }}
                      >
                        {t("account.SIGN_OUT")}
                      </Button>
                    </Popover>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      alignItems: "center",
                      display: "flex",
                      flex: desktop ? "1 1 0" : undefined,
                      gap: 1.25,
                      minHeight: desktop ? 0 : undefined,
                      p: 2,
                    }}
                  >
                    <Avatar sx={{ height: 36, width: 36 }}>{user?.username.slice(0, 1).toUpperCase()}</Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap variant="body2" sx={{ fontWeight: 700 }}>
                        {user?.username}
                      </Typography>
                      <Typography color="text.secondary" variant="caption">
                        {user?.role}
                      </Typography>
                    </Box>
                    <Tooltip title={t("account.SIGN_OUT")}>
                      <IconButton aria-label={t("account.SIGN_OUT")} onClick={() => void signOut()} size="small">
                        <LogoutOutlined />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>
            </>
          );
        }}
      </VireoApplicationNavigation>

      <AppShellNavigationContext.Provider value={shellNavigation}>
        <Box
          sx={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            height: "100dvh",
            maxWidth: "100%",
            minHeight: 0,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <Box
            component="main"
            sx={{
              display: "flex",
              flex: 1,
              maxWidth: "100%",
              minHeight: 0,
              minWidth: 0,
              overflow: "hidden",
              viewTransitionName: "app-page",
            }}
          >
            <Outlet />
          </Box>
          {!desktop && (
            <VireoMobileBottomNavigation
              aria-label={t("navigation.QUICK")}
              items={mobileNavigationItems}
              value={activeNavigationPath}
              onChange={navigateTo}
              sx={{
                position: "relative",
                zIndex: theme.zIndex.appBar,
              }}
            />
          )}
        </Box>
      </AppShellNavigationContext.Provider>
    </Box>
  );
}
