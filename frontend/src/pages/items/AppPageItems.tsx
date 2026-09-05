import { APP_QUERY_ENTITY } from "@/app/data/query/models/AppQueryEntityKey";
import { countQueryFilterRules, type QueryFilterDocument } from "@/app/data/query/models/QueryFilterDocument";
import {
  EntityQueryFiltersOverlay,
  EntityQueryFilterSummary,
  formatQueryResultCount,
  readEntityListState,
  useDebouncedSearchText,
  writeEntityListState,
  type EntityQueryFilterPresentation,
} from "@/features/entity-query-filters/public";
import { AppPageHeader } from "@/app/shell/layout/AppPageHeader";
import { AppPageLayout } from "@/app/shell/layout/AppPageLayout";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import { useAppAuth } from "@/app/shell/hooks/useAppAuth";
import {
  ItemFormOverlay,
  ItemHistoryOverlay,
  useItemDeleteMutation,
  usePendingItemUpdateId,
  useItemSearchQuery,
  useItemTableColumns,
  type Item,
} from "@/features/item/public";
import { AddRounded, CloseRounded, FilterAltOutlined, SearchRounded } from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  IconButton,
  InputAdornment,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import {
  PageOverlay,
  useGuardedOverlayModeSwitch,
  usePageOverlayModes,
  useVireoConfirmation,
  VireoLoadingRegion,
  VireoResponsiveTable,
  type OverlayRenderers,
  type VireoResponsiveTableFilters,
  type VireoResponsiveTableLabels,
} from "@vireocodedev/ui";
import React from "react";
import { useTranslation } from "react-i18next";
import { ITEMS_TRANSLATION_NAMESPACE } from "@/app/app.localization";
import { APP_THEME_TOKENS } from "@/app/ui/theme/config/theme.tokens";
import { sigConnectivityStatus } from "@/app/offline/signals/sigConnectivityStatus";
import { sigCacheReadiness } from "@/app/offline/signals/sigCacheReadiness";
import { sigSyncSummary } from "@/app/offline/signals/sigSyncSummary";
import { CacheStatus, ConnectivityStatus, SyncStatus } from "@/app/offline/models/AppOffline";
import { sigOfflineRecoveryInProgress } from "@/app/offline/signals/sigOfflineRecoveryInProgress";

type ItemOverlayModes = {
  form: { item?: Item };
  history: { item: Item };
  filters: Record<string, never>;
};

const ITEM_LIST_STATE_KEY = "items";
const ITEM_TABLE_LAYERS = { stickyToolbar: 4, stickyRowHeader: 3 } as const;
const ITEM_TABLE_SX = { flex: 1, height: "100%", minHeight: 0 } as const;
const ITEM_COMMAND_CONTROL_HEIGHT = 56;
const DEFAULT_TABLE_FILTERS: VireoResponsiveTableFilters = {
  page: 0,
  rowsPerPage: 10,
  sortBy: "name",
  sortDirection: "asc",
};

function getItemRowKey(item: Item) {
  return item.id;
}
type ItemListContentProps = {
  canManage: boolean;
  filters: VireoResponsiveTableFilters;
  onFiltersChange: React.Dispatch<React.SetStateAction<VireoResponsiveTableFilters>>;
  queryFilters: QueryFilterDocument | null;
  search: ReturnType<typeof useDebouncedSearchText>;
  structuredFilterCount: number;
  tableSize: "small" | "medium";
  presentation: EntityQueryFilterPresentation;
  onClearQueryFilters: () => void;
  onClearAllFilters: () => void;
  onRemoveQueryFilter: (index: number) => void;
  onOpenEdit: (item: Item) => void;
  onOpenCreate: () => void;
  onOpenFilters: () => void;
  onOpenHistory: (item: Item) => void;
  onRequestDelete: (item: Item) => Promise<void>;
};

export type AppPageItemsListState = ReturnType<typeof useItemSearchQuery>;

type AppPageItemsListViewProps = ItemListContentProps & {
  result: AppPageItemsListState;
};

export const AppPageItemsListView = React.memo(function AppPageItemsListView({
  canManage,
  filters,
  onFiltersChange,
  queryFilters,
  search,
  structuredFilterCount,
  tableSize,
  presentation,
  onClearQueryFilters,
  onClearAllFilters,
  onRemoveQueryFilter,
  onOpenEdit,
  onOpenCreate,
  onOpenFilters,
  onOpenHistory,
  onRequestDelete,
  result,
}: AppPageItemsListViewProps) {
  const { t, i18n } = useTranslation(ITEMS_TRANSLATION_NAMESPACE);
  const labels = React.useMemo<VireoResponsiveTableLabels>(
    () => ({
      table: t("table.table"),
      loadingTable: t("table.loadingTable"),
      loadingNextPage: t("table.loadingNextPage"),
      loadedNextPage: t("table.loadedNextPage"),
      noData: t("table.noData"),
      showMore: t("table.showMore"),
      showLess: t("table.showLess"),
      rowsPerPage: t("table.rowsPerPage"),
      paginationMoreThan: (from, to) => t("table.paginationMoreThan", { from, to }),
      paginationRange: (from, to, count) => t("table.paginationRange", { from, to, count }),
      paginationItem: type => t("table.paginationItem", { type }),
      filters: t("table.filters"),
      clearFilters: t("table.clearFilters"),
      filtersDone: t("table.filtersDone"),
      sortBy: t("table.sortBy"),
      sortDirection: t("table.sortDirection"),
      ascending: t("table.ascending"),
      descending: t("table.descending"),
      ascendingSortDirection: t("table.ascendingSortDirection"),
      descendingSortDirection: t("table.descendingSortDirection"),
    }),
    [t],
  );
  const pendingUpdateId = usePendingItemUpdateId();
  const offline = sigConnectivityStatus.value === ConnectivityStatus.OFFLINE;
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const totalResults = result.data?.totalElements;
  const items = result.data?.content ?? [];
  const hasResolvedData = result.data !== undefined;
  const initialError = result.isError && !hasResolvedData;
  const refreshError = result.isError && hasResolvedData;
  const hasActiveConstraints = search.committed.length > 0 || queryFilters !== null;
  const resultCountLabel = t("results", {
    count: totalResults ?? 0,
    formattedCount: formatQueryResultCount(totalResults ?? 0, i18n.resolvedLanguage),
  });
  const dataState = result.isLoading
    ? "loading"
    : initialError
      ? "error"
      : refreshError
        ? "refresh-error"
        : result.isRefreshing
          ? "refreshing"
          : items.length === 0
            ? "empty"
            : "loaded";
  const columns = useItemTableColumns({
    onHistory: onOpenHistory,
    historyDisabled: offline,
    onEdit: canManage ? onOpenEdit : undefined,
    onDelete: canManage ? onRequestDelete : undefined,
  });
  const getRowSx = React.useCallback(
    (
      item: Item,
      _rowIndex: number,
      layout: "mobile" | "desktop",
    ): Record<
      string,
      {
        backgroundColor: string | undefined;
        transition: string;
        "@media (prefers-reduced-motion: reduce)": { transition: string };
      }
    > => {
      const feedback = {
        backgroundColor: item.id === pendingUpdateId ? "action.selected" : undefined,
        transition: `background-color ${APP_THEME_TOKENS.motion.duration.emphasized}ms ${APP_THEME_TOKENS.motion.easing.standard}`,
        "@media (prefers-reduced-motion: reduce)": { transition: "none" },
      };
      return layout === "desktop" ? { "& > td": feedback } : { "& .MuiAccordionSummary-root": feedback };
    },
    [pendingUpdateId],
  );

  return (
    <Stack spacing={{ xs: 0, sm: 2 }} sx={{ flex: 1, height: "100%", minHeight: 0, overflow: "hidden" }}>
      <Stack spacing={1} sx={{ flex: "0 0 auto", p: { xs: 2, sm: 0 } }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
          <TextField
            data-items-search
            fullWidth
            size="medium"
            value={search.input}
            onChange={event => search.setInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") search.commitNow();
            }}
            placeholder={t("search.placeholder")}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchRounded />
                  </InputAdornment>
                ),
                endAdornment: search.input ? (
                  <InputAdornment position="end">
                    <IconButton aria-label={t("search.clear")} edge="end" onClick={search.clear}>
                      <CloseRounded />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
            sx={{ maxWidth: 520 }}
          />
          <ButtonGroup
            size="medium"
            variant="outlined"
            sx={{ display: { xs: "none", sm: "inline-flex" }, height: ITEM_COMMAND_CONTROL_HEIGHT }}
          >
            <Button startIcon={<FilterAltOutlined />} onClick={onOpenFilters}>
              {t("filters.open")}
              {structuredFilterCount > 0 ? ` (${structuredFilterCount})` : ""}
            </Button>
            {structuredFilterCount > 0 && (
              <Tooltip title={t("filters.clearAllLabel")}>
                <Button
                  aria-label={t("filters.clearAllLabel")}
                  onClick={onClearQueryFilters}
                  sx={{ minWidth: 44, px: 1 }}
                >
                  <CloseRounded />
                </Button>
              </Tooltip>
            )}
          </ButtonGroup>
        </Stack>
        <Box
          sx={{
            display: { xs: "grid", sm: "none" },
            gridTemplateColumns: "minmax(0, 1fr) auto",
            columnGap: 0.5,
            minWidth: 0,
            alignItems: "center",
          }}
        >
          <ButtonGroup
            size="medium"
            variant="outlined"
            sx={{ gridColumn: 1, height: ITEM_COMMAND_CONTROL_HEIGHT, justifySelf: "start" }}
          >
            <Button startIcon={<FilterAltOutlined />} onClick={onOpenFilters}>
              {t("filters.open")}
              {structuredFilterCount > 0 ? ` (${structuredFilterCount})` : ""}
            </Button>
            {structuredFilterCount > 0 && (
              <Tooltip title={t("filters.clearAllLabel")}>
                <Button
                  aria-label={t("filters.clearAllLabel")}
                  onClick={onClearQueryFilters}
                  sx={{ minWidth: 44, px: 1 }}
                >
                  <CloseRounded />
                </Button>
              </Tooltip>
            )}
          </ButtonGroup>
          <Chip
            aria-hidden={totalResults == null ? true : undefined}
            color={result.isRefreshing ? "primary" : "default"}
            data-items-result-count="mobile"
            data-items-result-count-state={totalResults == null ? "reserved" : "resolved"}
            label={resultCountLabel}
            size="small"
            sx={{
              gridColumn: 2,
              justifyContent: "center",
              minWidth: "11ch",
              visibility: totalResults == null ? "hidden" : "visible",
              whiteSpace: "nowrap",
            }}
            variant="outlined"
          />
        </Box>
        {queryFilters && (
          <Box
            sx={{
              display: { xs: "block", sm: "none" },
              minWidth: 0,
              overflowX: "auto",
              overscrollBehaviorX: "contain",
              scrollbarWidth: "none",
              touchAction: "pan-x",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            <EntityQueryFilterSummary
              value={queryFilters}
              presentation={presentation}
              onRemove={onRemoveQueryFilter}
              singleLine
            />
          </Box>
        )}
        {queryFilters && (
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <EntityQueryFilterSummary value={queryFilters} presentation={presentation} onRemove={onRemoveQueryFilter} />
          </Box>
        )}
      </Stack>
      <VireoLoadingRegion
        loading={result.isRefreshing}
        loadingLabel={t("table.refreshing")}
        data-items-data-state={dataState}
        sx={{
          bgcolor: { xs: "appSurface.screen", sm: "appSurface.content" },
          borderColor: "divider",
          display: "flex",
          flex: 1,
          minHeight: 0,
          position: "relative",
        }}
      >
        {({ loadingVisible }) => (
          <>
            {loadingVisible && (
              <LinearProgress
                aria-hidden
                variant={reducedMotion ? "determinate" : "indeterminate"}
                value={reducedMotion ? 100 : undefined}
                sx={{
                  position: "absolute",
                  top: 0,
                  insetInline: 0,
                  height: 2,
                  zIndex: 5,
                }}
              />
            )}
            {refreshError && (
              <Alert
                data-items-refresh-error
                severity="warning"
                action={
                  <Button color="inherit" onClick={result.onRetry}>
                    {t("error.retry")}
                  </Button>
                }
                sx={{
                  boxShadow: 4,
                  insetInline: 8,
                  maxWidth: 720,
                  position: "absolute",
                  top: 8,
                  zIndex: 6,
                }}
              >
                {t("error.refreshMessage")}
              </Alert>
            )}
            <VireoResponsiveTable
              data-items-table
              layout={result.layout}
              columns={columns}
              data={items}
              filters={filters}
              onFiltersChange={onFiltersChange}
              labels={labels}
              layers={ITEM_TABLE_LAYERS}
              getRowKey={getItemRowKey}
              getRowSx={getRowSx}
              totalCount={totalResults ?? 0}
              skeleton={result.isLoading && !hasResolvedData}
              titleColumn="name"
              titleEndAdornmentColumn="status"
              actionsColumn="actions"
              hasNextPage={result.hasNextPage}
              isFetchingNextPage={result.isFetchingNextPage}
              onLoadNextPage={result.onLoadNextPage}
              size={tableSize}
              sx={ITEM_TABLE_SX}
              renderEmptyState={() =>
                initialError ? (
                  <Alert
                    data-items-initial-error
                    severity="error"
                    action={
                      <Stack direction="row" sx={{ flexWrap: "wrap" }}>
                        <Button color="inherit" onClick={result.onRetry}>
                          {t("error.retry")}
                        </Button>
                        {queryFilters ? (
                          <>
                            <Button color="inherit" onClick={onOpenFilters}>
                              {t("error.edit")}
                            </Button>
                            <Button color="inherit" onClick={onClearQueryFilters}>
                              {t("error.clear")}
                            </Button>
                          </>
                        ) : null}
                      </Stack>
                    }
                    sx={{ maxWidth: 720 }}
                  >
                    {t("error.message")}
                  </Alert>
                ) : (
                  <Stack data-items-empty-state spacing={1} sx={{ alignItems: "center", py: 1 }}>
                    <Typography color="text.secondary">
                      {hasActiveConstraints ? t("empty.filtered") : t(canManage ? "empty.first" : "empty.none")}
                    </Typography>
                    {hasActiveConstraints ? (
                      <Button size="small" onClick={onClearAllFilters}>
                        {t("empty.clear")}
                      </Button>
                    ) : canManage ? (
                      <Button size="small" variant="contained" onClick={onOpenCreate}>
                        {t("empty.create")}
                      </Button>
                    ) : null}
                  </Stack>
                )
              }
            />
          </>
        )}
      </VireoLoadingRegion>
    </Stack>
  );
});

const ItemListContent = React.memo(function ItemListContent(props: ItemListContentProps) {
  const result = useItemSearchQuery(props.filters, {
    searchText: props.search.committed,
    queryFilters: props.queryFilters,
  });
  return <AppPageItemsListView {...props} result={result} />;
});

export function AppPageItemsFrame({
  canManage,
  children,
  onOpenCreate,
}: React.PropsWithChildren<{ canManage: boolean; onOpenCreate: () => void }>) {
  const { t } = useTranslation(ITEMS_TRANSLATION_NAMESPACE);

  return (
    <AppPageLayout
      paddingOnCompact={false}
      scrollMode="contained"
      header={
        <AppPageHeader
          title={t("header.title")}
          description={t("header.description")}
          primaryAction={
            canManage
              ? {
                  icon: <AddRounded />,
                  label: t("header.create"),
                  onClick: onOpenCreate,
                  preview: t("header.createPreview"),
                }
              : undefined
          }
        />
      }
    >
      {children}
    </AppPageLayout>
  );
}

export function AppPageItems() {
  const { t } = useTranslation(ITEMS_TRANSLATION_NAMESPACE);
  const { user } = useAppAuth();
  const preferences = sigAppPreferences.value;
  const canManage = user?.role === "SUPERADMIN";
  const canMutate =
    canManage &&
    !sigOfflineRecoveryInProgress.value &&
    sigSyncSummary.value.status !== SyncStatus.SYNCING &&
    sigCacheReadiness.value.status !== CacheStatus.HYDRATING;
  const confirm = useVireoConfirmation();
  const { mutateAsync: deleteItem } = useItemDeleteMutation();
  const initialState = React.useMemo(() => readEntityListState<VireoResponsiveTableFilters>(ITEM_LIST_STATE_KEY), []);
  const search = useDebouncedSearchText(initialState?.searchText ?? "");
  const [queryFilters, setQueryFilters] = React.useState<QueryFilterDocument | null>(initialState?.filters ?? null);
  const [filters, setFilters] = React.useState<VireoResponsiveTableFilters>(
    initialState?.table ?? DEFAULT_TABLE_FILTERS,
  );
  const presentation = React.useMemo<EntityQueryFilterPresentation>(
    () => ({
      fields: {
        name: { label: t("filterFields.name") },
        description: { label: t("filterFields.description") },
        quantity: { label: t("filterFields.quantity") },
        status: {
          label: t("filterFields.status"),
          enumLabels: {
            DRAFT: t("filterFields.statusValues.DRAFT"),
            ACTIVE: t("filterFields.statusValues.ACTIVE"),
            ARCHIVED: t("filterFields.statusValues.ARCHIVED"),
          },
        },
      },
    }),
    [t],
  );
  const overlayRenderers = React.useMemo<OverlayRenderers<ItemOverlayModes>>(
    () => ({
      form: (overlayProps, payload) => (
        <ItemFormOverlay key={payload.item?.id ?? "new"} {...overlayProps} item={payload.item} />
      ),
      history: (overlayProps, payload) => <ItemHistoryOverlay {...overlayProps} item={payload.item} />,
      filters: overlayProps => (
        <EntityQueryFiltersOverlay
          {...overlayProps}
          entityKey={APP_QUERY_ENTITY.item}
          title={t("filters.title")}
          value={queryFilters}
          presentation={presentation}
          onApply={value => {
            setQueryFilters(value);
            setFilters(current => ({ ...current, page: 0 }));
          }}
          onClear={() => {
            setQueryFilters(null);
            setFilters(current => ({ ...current, page: 0 }));
          }}
        />
      ),
    }),
    [presentation, queryFilters, t],
  );
  const overlays = usePageOverlayModes<ItemOverlayModes>(overlayRenderers);
  const openOverlay = useGuardedOverlayModeSwitch<ItemOverlayModes>(overlays.overlay.open, overlays.open);

  const openCreate = React.useCallback(() => {
    openOverlay("form", {});
  }, [openOverlay]);
  const openEdit = React.useCallback(
    (item: Item) => {
      openOverlay("form", { item });
    },
    [openOverlay],
  );
  const openHistory = React.useCallback((item: Item) => openOverlay("history", { item }), [openOverlay]);
  const openFilters = React.useCallback(() => openOverlay("filters", {}), [openOverlay]);
  const structuredFilterCount = countQueryFilterRules(queryFilters);

  const clearQueryFilters = React.useCallback(() => {
    setQueryFilters(null);
    setFilters(current => ({ ...current, page: 0 }));
  }, []);

  const clearAllFilters = React.useCallback(() => {
    search.clear();
    setQueryFilters(null);
    setFilters(current => ({ ...current, page: 0 }));
  }, [search]);

  const removeQueryFilter = React.useCallback((index: number) => {
    setQueryFilters(current => {
      if (!current) return null;
      const rows = current.rows.filter((_, rowIndex) => rowIndex !== index);
      return rows.length > 0 ? { ...current, rows } : null;
    });
    setFilters(current => ({ ...current, page: 0 }));
  }, []);

  React.useEffect(() => {
    setFilters(current => (current.page === 0 ? current : { ...current, page: 0 }));
  }, [search.committed]);

  React.useEffect(() => {
    writeEntityListState(ITEM_LIST_STATE_KEY, {
      searchText: search.input,
      filters: queryFilters,
      table: filters,
    });
  }, [filters, queryFilters, search.input]);
  const requestDelete = React.useCallback(
    async (item: Item) => {
      await confirm({
        title: t("delete.title"),
        message: <>{t("delete.message", { name: item.name })}</>,
        confirmLabel: t("delete.confirm"),
        confirmColor: "error",
        onConfirm: () => deleteItem(item),
      });
    },
    [confirm, deleteItem, t],
  );

  return (
    <AppPageItemsFrame canManage={canMutate} onOpenCreate={openCreate}>
      <ItemListContent
        canManage={canMutate}
        filters={filters}
        onFiltersChange={setFilters}
        queryFilters={queryFilters}
        search={search}
        structuredFilterCount={structuredFilterCount}
        tableSize={preferences.tableSize}
        presentation={presentation}
        onClearQueryFilters={clearQueryFilters}
        onClearAllFilters={clearAllFilters}
        onRemoveQueryFilter={removeQueryFilter}
        onOpenEdit={openEdit}
        onOpenCreate={openCreate}
        onOpenFilters={openFilters}
        onOpenHistory={openHistory}
        onRequestDelete={requestDelete}
      />
      <PageOverlay
        overlayKey="item"
        open={overlays.overlay.open}
        onRequestClose={overlays.close}
        render={overlays.overlay.render}
      />
    </AppPageItemsFrame>
  );
}
