import type React from "react";
import {
  ArchiveOutlined,
  ArrowForwardRounded,
  AssignmentOutlined,
  Inventory2Outlined,
  RefreshRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import { Alert, Box, Button, Card, CardContent, Chip, Divider, LinearProgress, Stack, Typography } from "@mui/material";
import { VireoLoadingRegion, VireoResponsiveCard } from "@vireocodedev/ui";
import { useTranslation } from "react-i18next";
import { HOME_TRANSLATION_NAMESPACE } from "@/app/app.localization";
import { AppSkeletonText } from "@/app/shell/components/AppSkeletonText";
import { AppPageHeader } from "@/app/shell/layout/AppPageHeader";
import { AppPageLayout } from "@/app/shell/layout/AppPageLayout";
import { useAppTranslation } from "@/app/ui/localization/use-app-translation";
import { VireoContainerGrid } from "@/app/ui/toolkit/components/layout/VireoContainerGrid";
import type { Item } from "@/features/item/public";
import { buildHomeOverviewSnapshot, selectHomeAttentionItems } from "./home-overview";

export type AppPageHomeViewProps = {
  error?: boolean;
  items?: readonly Item[];
  loading?: boolean;
  onOpenItems?: () => void;
  onRetry?: () => void;
  totalItems?: number;
};

const LOADING_ITEMS: readonly Item[] = [
  {
    description: "",
    id: "00000000-0000-4000-8000-000000000001",
    version: 0,
    name: "Loading inventory item",
    quantity: 0,
    status: "ACTIVE",
  },
  {
    description: "",
    id: "00000000-0000-4000-8000-000000000002",
    version: 0,
    name: "Loading inventory item",
    quantity: 0,
    status: "DRAFT",
  },
  {
    description: "",
    id: "00000000-0000-4000-8000-000000000003",
    version: 0,
    name: "Loading inventory item",
    quantity: 10,
    status: "ACTIVE",
  },
];

function contentLeaf(loading: boolean, loadingVisible: boolean, content: React.ReactNode) {
  return loading ? <AppSkeletonText visible={loadingVisible}>{content}</AppSkeletonText> : content;
}

export function AppPageHomeView({
  error = false,
  items = [],
  loading = false,
  onOpenItems,
  onRetry,
  totalItems,
}: AppPageHomeViewProps) {
  const { t: tApp } = useAppTranslation();
  const { t } = useTranslation(HOME_TRANSLATION_NAMESPACE);
  const displayItems = loading ? LOADING_ITEMS : items;
  const snapshot = buildHomeOverviewSnapshot(displayItems, totalItems);
  const attentionItems = selectHomeAttentionItems(displayItems);
  const statusLabels = {
    ACTIVE: t("health.active"),
    ARCHIVED: t("health.archived"),
    DRAFT: t("health.draft"),
  } as const;
  const statusRows = [
    { color: "success.main", count: snapshot.activeCount, key: "active" },
    { color: "warning.main", count: snapshot.draftCount, key: "draft" },
    { color: "text.disabled", count: snapshot.archivedCount, key: "archived" },
  ] as const;
  const metrics = [
    { icon: <Inventory2Outlined />, key: "units", value: snapshot.totalUnits },
    { icon: <AssignmentOutlined />, key: "active", value: snapshot.activeCount },
    { icon: <WarningAmberRounded />, key: "attention", value: snapshot.lowStockCount },
    { icon: <ArchiveOutlined />, key: "draft", value: snapshot.draftCount },
  ] as const;

  return (
    <VireoLoadingRegion
      loading={loading}
      loadingLabel={tApp("loading.page")}
      sx={{ display: "flex", flex: "1 1 auto", height: "100%", minHeight: 0, minWidth: 0 }}
    >
      {({ loadingVisible }) => (
        <AppPageLayout
          paddingOnCompact={false}
          header={
            <AppPageHeader
              description={contentLeaf(loading, loadingVisible, t("header.description"))}
              title={contentLeaf(loading, loadingVisible, t("header.title"))}
            />
          }
        >
          <Box
            data-app-overview-state={loading ? "loading" : error ? "error" : items.length === 0 ? "empty" : "loaded"}
            data-app-overview-loading-phase={loading ? (loadingVisible ? "visible" : "pending") : undefined}
            data-app-route-fallback-variant={loading ? "overview" : undefined}
            sx={{ minWidth: 0 }}
          >
            <Box
              data-app-overview-frame
              sx={{
                bgcolor: { xs: "appSurface.screen", sm: "appSurface.content" },
                borderColor: "divider",
                borderStyle: "solid",
                borderWidth: { xs: 0, sm: 1 },
                boxShadow: {
                  xs: "none",
                  sm: theme =>
                    `inset 0 1px 0 color-mix(in srgb, ${theme.palette.common.white} 8%, transparent), 0 18px 50px color-mix(in srgb, ${theme.palette.common.black} 8%, transparent)`,
                },
                maxWidth: 1280,
                mx: "auto",
                overflow: "hidden",
                p: { xs: 0, sm: 3, md: 4 },
                position: "relative",
                width: "100%",
                "&::before": {
                  bgcolor: "primary.main",
                  content: '""',
                  display: { xs: "none", sm: "block" },
                  height: 4,
                  insetInline: 0,
                  position: "absolute",
                  top: 0,
                },
              }}
            >
              <Box
                data-app-overview-hero
                sx={{
                  borderBottomColor: "divider",
                  borderBottomStyle: "solid",
                  borderBottomWidth: { xs: 1, sm: 0 },
                  p: { xs: 2, sm: 0 },
                  pb: { xs: 3, sm: 0 },
                }}
              >
                <VireoContainerGrid container spacing={3}>
                  <VireoContainerGrid size={{ xs: 12, md: 9 }}>
                    <Box sx={{ maxWidth: 760 }}>
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                        <Chip
                          color="success"
                          label={contentLeaf(loading, loadingVisible, t("status.live"))}
                          size="small"
                        />
                        <Chip
                          label={contentLeaf(loading, loadingVisible, t("status.api"))}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={contentLeaf(loading, loadingVisible, t("status.offline"))}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                      <Typography
                        component="h2"
                        sx={{
                          fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
                          fontWeight: 850,
                          letterSpacing: "-0.035em",
                          lineHeight: 1.08,
                          mt: 2,
                        }}
                      >
                        {contentLeaf(loading, loadingVisible, t("title"))}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        sx={{ fontSize: { xs: "0.9375rem", sm: "1.0625rem" }, mt: 1.5 }}
                      >
                        {contentLeaf(loading, loadingVisible, t("introduction"))}
                      </Typography>
                    </Box>
                  </VireoContainerGrid>
                  <VireoContainerGrid size={{ xs: 12, md: 3 }}>
                    <Box
                      sx={theme => ({
                        alignItems: "flex-end",
                        display: "flex",
                        height: "100%",
                        "& > .MuiButton-root": { width: "100%" },
                        [theme.containerQueries.up("md")]: {
                          justifyContent: "flex-end",
                          "& > .MuiButton-root": { width: "auto" },
                        },
                      })}
                    >
                      <Button
                        disabled={loading || !onOpenItems}
                        endIcon={<ArrowForwardRounded />}
                        onClick={onOpenItems}
                        size="large"
                        sx={{ whiteSpace: "nowrap" }}
                        variant="contained"
                      >
                        {t("actions.openInventory")}
                      </Button>
                    </Box>
                  </VireoContainerGrid>
                </VireoContainerGrid>
              </Box>

              {error ? (
                <Alert
                  action={
                    onRetry ? (
                      <Button color="inherit" onClick={onRetry} startIcon={<RefreshRounded />}>
                        {t("actions.retry")}
                      </Button>
                    ) : undefined
                  }
                  severity="error"
                  sx={{ m: { xs: 2, sm: 0 }, mt: { xs: 2, sm: 3 } }}
                >
                  {t("error")}
                </Alert>
              ) : null}

              <Box
                data-app-overview-metrics
                sx={{
                  mt: { xs: 0, sm: 4 },
                  p: { xs: 2, sm: 0 },
                }}
              >
                <VireoContainerGrid container spacing={{ xs: 1.5, sm: 2 }}>
                  {metrics.map(metric => (
                    <VireoContainerGrid key={metric.key} size={{ xs: 6, lg: 3 }}>
                      <Card
                        data-app-overview-card={metric.key}
                        variant="inset"
                        sx={{ bgcolor: { xs: "appSurface.content", sm: "appSurface.recessed" }, height: "100%" }}
                      >
                        <CardContent sx={{ p: { xs: 2, sm: 2.5 }, "&:last-child": { pb: { xs: 2, sm: 2.5 } } }}>
                          <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                            <Box sx={{ color: "primary.main", display: "flex" }}>{metric.icon}</Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                sx={{ fontSize: { xs: "1.5rem", sm: "1.875rem" }, fontWeight: 850, lineHeight: 1 }}
                              >
                                {contentLeaf(loading, loadingVisible, metric.value)}
                              </Typography>
                              <Typography color="text.secondary" sx={{ fontSize: "0.8125rem", mt: 0.75 }}>
                                {contentLeaf(loading, loadingVisible, t(`metrics.${metric.key}`))}
                              </Typography>
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    </VireoContainerGrid>
                  ))}
                </VireoContainerGrid>
              </Box>

              <Box sx={{ mt: { xs: 0, sm: 2 } }}>
                <VireoContainerGrid container spacing={{ xs: 0, sm: 2 }}>
                  <VireoContainerGrid size={{ xs: 12, lg: 7 }}>
                    <Box
                      sx={theme => ({
                        borderTopColor: "divider",
                        borderTopStyle: "solid",
                        borderTopWidth: 1,
                        height: "100%",
                        minWidth: 0,
                        [theme.containerQueries.up("sm")]: { borderTopWidth: 0 },
                      })}
                    >
                      <VireoResponsiveCard data-app-overview-health variant="inset" sx={{ height: "100%" }}>
                        <CardContent sx={{ p: { xs: 2, sm: 3 }, "&:last-child": { pb: { xs: 3, sm: 3 } } }}>
                          <Typography component="h3" sx={{ fontSize: "1.125rem", fontWeight: 800 }}>
                            {contentLeaf(loading, loadingVisible, t("health.title"))}
                          </Typography>
                          <Typography color="text.secondary" sx={{ fontSize: "0.875rem", mt: 0.5 }}>
                            {contentLeaf(
                              loading,
                              loadingVisible,
                              t("health.description", { count: snapshot.totalItems }),
                            )}
                          </Typography>
                          <Stack spacing={2.25} sx={{ mt: 3 }}>
                            {statusRows.map(row => {
                              const percentage =
                                displayItems.length === 0 ? 0 : (row.count / displayItems.length) * 100;
                              return (
                                <Box key={row.key}>
                                  <Stack direction="row" sx={{ justifyContent: "space-between" }}>
                                    <Typography sx={{ fontSize: "0.875rem", fontWeight: 700 }}>
                                      {contentLeaf(loading, loadingVisible, t(`health.${row.key}`))}
                                    </Typography>
                                    <Typography color="text.secondary" sx={{ fontSize: "0.875rem" }}>
                                      {contentLeaf(loading, loadingVisible, row.count)}
                                    </Typography>
                                  </Stack>
                                  <LinearProgress
                                    aria-label={t(`health.${row.key}`)}
                                    value={percentage}
                                    variant="determinate"
                                    sx={{
                                      bgcolor: "action.hover",
                                      height: 8,
                                      mt: 1,
                                      "& .MuiLinearProgress-bar": { bgcolor: row.color },
                                    }}
                                  />
                                </Box>
                              );
                            })}
                          </Stack>
                        </CardContent>
                      </VireoResponsiveCard>
                    </Box>
                  </VireoContainerGrid>

                  <VireoContainerGrid size={{ xs: 12, lg: 5 }}>
                    <Box
                      sx={theme => ({
                        borderTopColor: "divider",
                        borderTopStyle: "solid",
                        borderTopWidth: 1,
                        height: "100%",
                        minWidth: 0,
                        [theme.containerQueries.up("sm")]: { borderTopWidth: 0 },
                      })}
                    >
                      <VireoResponsiveCard data-app-overview-attention variant="inset" sx={{ height: "100%" }}>
                        <CardContent sx={{ p: { xs: 2, sm: 3 }, "&:last-child": { pb: { xs: 3, sm: 3 } } }}>
                          <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                            <Box>
                              <Typography component="h3" sx={{ fontSize: "1.125rem", fontWeight: 800 }}>
                                {contentLeaf(loading, loadingVisible, t("attention.title"))}
                              </Typography>
                              <Typography color="text.secondary" sx={{ fontSize: "0.875rem", mt: 0.5 }}>
                                {contentLeaf(loading, loadingVisible, t("attention.description"))}
                              </Typography>
                            </Box>
                            <Chip
                              color={attentionItems.length > 0 ? "warning" : "success"}
                              label={attentionItems.length}
                              size="small"
                            />
                          </Stack>
                          <Stack divider={<Divider flexItem />} sx={{ mt: 2 }}>
                            {attentionItems.length === 0 ? (
                              <Typography color="text.secondary" sx={{ py: 2 }}>
                                {t(items.length === 0 ? "attention.emptyInventory" : "attention.clear")}
                              </Typography>
                            ) : (
                              attentionItems.map(item => (
                                <Stack
                                  direction="row"
                                  key={item.id}
                                  sx={{ alignItems: "center", justifyContent: "space-between", py: 1.5 }}
                                >
                                  <Box sx={{ minWidth: 0, pr: 2 }}>
                                    <Typography noWrap sx={{ fontSize: "0.875rem", fontWeight: 700 }}>
                                      {contentLeaf(loading, loadingVisible, item.name)}
                                    </Typography>
                                    <Typography color="text.secondary" sx={{ fontSize: "0.75rem" }}>
                                      {contentLeaf(loading, loadingVisible, statusLabels[item.status])}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    color={item.quantity <= 5 ? "warning" : "default"}
                                    label={contentLeaf(
                                      loading,
                                      loadingVisible,
                                      t("attention.units", { count: item.quantity }),
                                    )}
                                    size="small"
                                    variant="outlined"
                                  />
                                </Stack>
                              ))
                            )}
                          </Stack>
                        </CardContent>
                      </VireoResponsiveCard>
                    </Box>
                  </VireoContainerGrid>
                </VireoContainerGrid>
              </Box>
            </Box>
          </Box>
        </AppPageLayout>
      )}
    </VireoLoadingRegion>
  );
}
