import { useAppShellNavigation } from "@/app/shell/hooks/useAppShellNavigation";
import { AppPageHeader } from "@/app/shell/layout/AppPageHeader";
import { AppPageLayout } from "@/app/shell/layout/AppPageLayout";
import { resetAppPreferences, updateAppPreference } from "@/app/ui/preferences/actions/app-preferences-actions";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import {
  AspectRatioOutlined,
  DarkModeOutlined,
  LanguageOutlined,
  LockOutlined,
  OpenInFullOutlined,
  RestartAltRounded,
  SearchRounded,
  TableRowsOutlined,
} from "@mui/icons-material";
import { Alert, Box, Button, InputAdornment, MenuItem, Select, Switch, TextField } from "@mui/material";
import { VireoPreferencePanel, type VireoPreferenceSectionDefinition } from "@vireocodedev/ui";
import React from "react";
import { useTranslation } from "react-i18next";
import { SETTINGS_TRANSLATION_NAMESPACE } from "@/app/app.localization";
import { sigCacheReadiness } from "@/app/offline/signals/sigCacheReadiness";
import { sigConnectivityStatus } from "@/app/offline/signals/sigConnectivityStatus";
import { sigOfflineSimulation } from "@/app/offline/signals/sigOfflineSimulation";
import { sigSyncSummary } from "@/app/offline/signals/sigSyncSummary";
import { patchOfflineSimulation } from "@/app/offline/actions/app-offline-actions";
import { discardOfflineChanges, resetOfflineCache, retryOfflineChanges } from "@/app/adapters/app-offline.adapter";
import { CacheStatus } from "@/app/offline/models/AppOffline";
import { reportAppError } from "@/app/diagnostics/app-diagnostics";

type AppPageSettingsOfflineOperations = Readonly<{
  discard: () => Promise<void>;
  reset: () => Promise<void>;
  retry: () => Promise<void>;
}>;

const defaultOfflineOperations: AppPageSettingsOfflineOperations = {
  discard: discardOfflineChanges,
  reset: resetOfflineCache,
  retry: retryOfflineChanges,
};

const OFFLINE_ACTION_FAILURE_KEYS = {
  retry: "offline.action.retryFailed",
  discard: "offline.action.discardFailed",
  reset: "offline.action.resetFailed",
} as const;
const SETTINGS_ACTION_SX = { minHeight: 48 } as const;

export function AppPageSettings({
  offlineOperations = defaultOfflineOperations,
}: {
  offlineOperations?: AppPageSettingsOfflineOperations;
}) {
  const { t } = useTranslation(SETTINGS_TRANSLATION_NAMESPACE);
  const { mobile } = useAppShellNavigation();
  const preferences = sigAppPreferences.value;
  const connectivity = sigConnectivityStatus.value;
  const simulation = sigOfflineSimulation.value;
  const cache = sigCacheReadiness.value;
  const sync = sigSyncSummary.value;
  const [search, setSearch] = React.useState("");
  const [offlineAction, setOfflineAction] = React.useState<"retry" | "discard" | "reset" | null>(null);
  const [offlineActionError, setOfflineActionError] = React.useState<NonNullable<typeof offlineAction> | null>(null);
  const offlineActionRef = React.useRef<typeof offlineAction>(null);
  const runOfflineAction = React.useCallback(
    (action: NonNullable<typeof offlineAction>, operation: () => Promise<void>) => {
      if (offlineActionRef.current !== null) return;
      offlineActionRef.current = action;
      setOfflineAction(action);
      setOfflineActionError(null);
      void operation()
        .catch(error => {
          reportAppError("Offline Settings action failed.", error, { action });
          setOfflineActionError(action);
        })
        .finally(() => {
          offlineActionRef.current = null;
          setOfflineAction(null);
        });
    },
    [],
  );
  const offlineActionBusy = offlineAction !== null;
  const sections: VireoPreferenceSectionDefinition[] = [
    {
      id: "offline",
      title: t("sections.offline"),
      items: [
        {
          id: "offline-simulation",
          icon: <DarkModeOutlined fontSize="small" />,
          title: t("offline.simulation.title"),
          description:
            cache.status === CacheStatus.UNAVAILABLE
              ? t("offline.simulation.unavailable")
              : t("offline.simulation.description"),
          control: (
            <Switch
              checked={simulation.enabled}
              disabled={cache.status === CacheStatus.UNAVAILABLE || offlineActionBusy}
              onChange={(_, enabled) => patchOfflineSimulation({ enabled })}
              slotProps={{ input: { "aria-label": t("offline.simulation.title") } }}
            />
          ),
        },
        {
          id: "offline-status",
          icon: <LanguageOutlined fontSize="small" />,
          title: t("offline.status.title"),
          description: t("offline.status.description", {
            cache:
              cache.status === CacheStatus.READY || cache.status === CacheStatus.STALE
                ? t("offline.status.ready")
                : t("offline.status.unavailable"),
            connection: t(`offline.status.${connectivity}`),
            failed: sync.failed,
            pending: sync.pending,
          }),
          control: (
            <Button
              aria-busy={offlineAction === "retry"}
              disabled={(sync.pending === 0 && sync.failed === 0) || offlineActionBusy}
              loading={offlineAction === "retry"}
              onClick={() => runOfflineAction("retry", offlineOperations.retry)}
              sx={SETTINGS_ACTION_SX}
              variant="outlined"
            >
              {t("offline.retry")}
            </Button>
          ),
        },
        {
          id: "offline-replay-failure",
          icon: <RestartAltRounded fontSize="small" />,
          title: t("offline.replayFailure.title"),
          description: t("offline.replayFailure.description"),
          control: (
            <Switch
              checked={simulation.failNextReplay}
              disabled={offlineActionBusy}
              onChange={(_, failNextReplay) => patchOfflineSimulation({ failNextReplay })}
              slotProps={{ input: { "aria-label": t("offline.replayFailure.title") } }}
            />
          ),
        },
        {
          id: "offline-discard",
          icon: <RestartAltRounded fontSize="small" />,
          title: t("offline.discard.title"),
          description: t("offline.discard.description"),
          control: (
            <Button
              aria-busy={offlineAction === "discard"}
              disabled={(sync.pending === 0 && sync.failed === 0) || offlineActionBusy}
              loading={offlineAction === "discard"}
              onClick={() => runOfflineAction("discard", offlineOperations.discard)}
              sx={SETTINGS_ACTION_SX}
              variant="outlined"
            >
              {t("offline.discard.action")}
            </Button>
          ),
        },
        {
          id: "offline-reset",
          icon: <RestartAltRounded fontSize="small" />,
          title: t("offline.reset.title"),
          description: t("offline.reset.description"),
          control: (
            <Button
              aria-busy={offlineAction === "reset"}
              disabled={offlineActionBusy}
              loading={offlineAction === "reset"}
              onClick={() => runOfflineAction("reset", offlineOperations.reset)}
              sx={SETTINGS_ACTION_SX}
              variant="outlined"
            >
              {t("offline.reset.action")}
            </Button>
          ),
        },
      ],
    },
    {
      id: "appearance",
      title: t("sections.appearance"),
      items: [
        {
          id: "locale",
          icon: <LanguageOutlined fontSize="small" />,
          title: t("language.title"),
          description: t("language.description"),
          control: (
            <Select
              size="medium"
              fullWidth
              value={preferences.locale}
              onChange={event => updateAppPreference("locale", event.target.value as "en" | "hr")}
              inputProps={{ "aria-label": t("language.title") }}
            >
              <MenuItem value="en">{t("language.ENGLISH")}</MenuItem>
              <MenuItem value="hr">{t("language.CROATIAN")}</MenuItem>
            </Select>
          ),
        },
        {
          id: "theme",
          icon: <DarkModeOutlined fontSize="small" />,
          title: t("theme.title"),
          description: t("theme.description"),
          control: (
            <Switch
              checked={preferences.darkMode}
              onChange={(_, value) => updateAppPreference("darkMode", value)}
              slotProps={{ input: { "aria-label": t("theme.title") } }}
            />
          ),
        },
        {
          id: "table-size",
          icon: <TableRowsOutlined fontSize="small" />,
          title: t("tableDensity.title"),
          description: t("tableDensity.description"),
          control: (
            <Select
              size="medium"
              fullWidth
              value={preferences.tableSize}
              onChange={event => updateAppPreference("tableSize", event.target.value as "small" | "medium")}
              inputProps={{ "aria-label": t("tableDensity.title") }}
            >
              <MenuItem value="small">{t("tableDensity.COMPACT")}</MenuItem>
              <MenuItem value="medium">{t("tableDensity.COMFORTABLE")}</MenuItem>
            </Select>
          ),
        },
      ],
    },
    {
      id: "layout",
      title: t("sections.layout"),
      items: [
        {
          id: "page-width",
          icon: <AspectRatioOutlined fontSize="small" />,
          title: t("pageWidth.title"),
          description: t("pageWidth.description"),
          control: (
            <Select
              size="medium"
              fullWidth
              value={preferences.pageWidth}
              onChange={event => updateAppPreference("pageWidth", event.target.value as "md" | "lg" | "xl" | "full")}
              inputProps={{ "aria-label": t("pageWidth.title") }}
            >
              <MenuItem value="md">{t("pageWidth.MEDIUM")}</MenuItem>
              <MenuItem value="lg">{t("pageWidth.LARGE")}</MenuItem>
              <MenuItem value="xl">{t("pageWidth.EXTRA_LARGE")}</MenuItem>
              <MenuItem value="full">{t("pageWidth.FULL")}</MenuItem>
            </Select>
          ),
        },
        {
          id: "surface",
          icon: <OpenInFullOutlined fontSize="small" />,
          title: t("desktopSurface.title"),
          description: t("desktopSurface.description"),
          control: (
            <Select
              size="medium"
              fullWidth
              value={preferences.desktopSurface}
              onChange={event =>
                updateAppPreference(
                  "desktopSurface",
                  event.target.value as "dialog" | "overlaySidePanel" | "dockedSidePanel",
                )
              }
              inputProps={{ "aria-label": t("desktopSurface.title") }}
            >
              <MenuItem value="dialog">{t("desktopSurface.DIALOG")}</MenuItem>
              <MenuItem value="overlaySidePanel">{t("desktopSurface.OVERLAY")}</MenuItem>
              <MenuItem value="dockedSidePanel">{t("desktopSurface.DOCKED")}</MenuItem>
            </Select>
          ),
        },
        {
          id: "resize",
          icon: <OpenInFullOutlined fontSize="small" />,
          title: t("resizablePanels.title"),
          description: t("resizablePanels.description"),
          control: (
            <Switch
              checked={preferences.allowSidePanelResize}
              onChange={(_, value) => updateAppPreference("allowSidePanelResize", value)}
              slotProps={{ input: { "aria-label": t("resizablePanels.title") } }}
            />
          ),
        },
        {
          id: "navigation",
          icon: <LockOutlined fontSize="small" />,
          title: t("lockNavigation.title"),
          description: t("lockNavigation.description"),
          control: (
            <Switch
              checked={preferences.navigationLocked}
              onChange={(_, value) => updateAppPreference("navigationLocked", value)}
              slotProps={{ input: { "aria-label": t("lockNavigation.title") } }}
            />
          ),
        },
      ],
    },
    {
      id: "reset",
      title: t("sections.defaults"),
      items: [
        {
          id: "reset-all",
          icon: <RestartAltRounded fontSize="small" />,
          title: t("reset.title"),
          description: t("reset.description"),
          control: (
            <Button
              size="medium"
              variant="outlined"
              startIcon={<RestartAltRounded />}
              onClick={resetAppPreferences}
              sx={SETTINGS_ACTION_SX}
            >
              {t("reset.action")}
            </Button>
          ),
        },
      ],
    },
  ];

  return (
    <AppPageLayout
      paddingOnCompact={false}
      header={
        <AppPageHeader
          title={t("header.title")}
          description={t("header.description")}
          actions={
            <TextField
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={t("search.placeholder")}
              size="medium"
              sx={{ width: { xs: "100%", sm: 300 } }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRounded fontSize="small" />
                    </InputAdornment>
                  ),
                },
                htmlInput: { "aria-label": t("search.placeholder") },
              }}
            />
          }
        />
      }
    >
      {mobile && (
        <Box
          data-settings-compact-command-section
          sx={{
            borderBottom: "1px solid var(--mui-palette-divider)",
            bgcolor: "appSurface.screen",
            p: 2,
          }}
        >
          <TextField
            fullWidth
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={t("search.placeholder")}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded fontSize="small" />
                  </InputAdornment>
                ),
              },
              htmlInput: { "aria-label": t("search.placeholder") },
            }}
          />
        </Box>
      )}
      {offlineActionError && (
        <Alert
          aria-live="assertive"
          onClose={() => setOfflineActionError(null)}
          role="alert"
          severity="error"
          sx={{ mx: 2, mt: 2 }}
        >
          {t(OFFLINE_ACTION_FAILURE_KEYS[offlineActionError])}
        </Alert>
      )}
      <VireoPreferencePanel
        sections={sections}
        searchQuery={search}
        emptyState={<>{t("search.empty", { search })}</>}
        defaultExpandedSectionIds={["appearance", "layout", "offline"]}
        slotProps={{ section: { slotProps: { heading: { component: "h2" } } } }}
        sx={{ mt: 0 }}
      />
    </AppPageLayout>
  );
}
