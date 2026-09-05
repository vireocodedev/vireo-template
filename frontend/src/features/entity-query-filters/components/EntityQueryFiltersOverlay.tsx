import React from "react";
import { Alert, Box, Button, CircularProgress, LinearProgress, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
  VireoOverlayHeader,
  VireoLoadingRegion,
  VireoResponsiveOverlayFrame,
  useUnsavedChangesRegistration,
  useUnsavedChangesRequestDiscard,
} from "@vireocodedev/ui";
import { useVireoForm } from "@vireocodedev/ui/forms";
import { QueryEngineQuery } from "@/app/data/query/api/queryEngine.api";
import type { AppQueryEntityKey } from "@/app/data/query/models/AppQueryEntityKey";
import type { QueryFilterDocument } from "@/app/data/query/models/QueryFilterDocument";
import type { EntityQueryFilterPresentation, QueryFilterRuleDraft } from "../models/EntityQueryFilters";
import {
  createQueryFilterCandidates,
  queryFilterDocumentToDraft,
  validateQueryFilterDraft,
} from "../services/entityQueryFilters";
import { sigAppPreferences } from "@/app/ui/preferences/signals/sigAppPreferences";
import { EntityQueryFiltersForm } from "./EntityQueryFiltersForm";
import { useEntityQueryFiltersTranslation } from "../localization/use-entity-query-filters-translation";

export type EntityQueryFiltersOverlayProps = {
  entityKey: AppQueryEntityKey;
  title: string;
  open: boolean;
  value: QueryFilterDocument | null;
  presentation?: EntityQueryFilterPresentation;
  onApply: (value: QueryFilterDocument | null) => void;
  onClear: () => void;
  onClose: () => void;
  onExited?: () => void;
};

type EntityQueryFiltersOverlayContentProps = Pick<
  EntityQueryFiltersOverlayProps,
  "entityKey" | "title" | "open" | "value" | "onClear" | "onClose" | "onExited"
> & {
  candidates: ReturnType<typeof createQueryFilterCandidates>;
  definitionAvailable: boolean;
  definitionError: boolean;
  dirty: boolean;
  errors: Record<string, string>;
  initialLoading: boolean;
  refreshing: boolean;
  rules: QueryFilterRuleDraft[];
  onClearErrors: () => void;
  onRefetch: () => void;
  onRulesChange: (rules: QueryFilterRuleDraft[]) => void;
  onSubmit: () => void;
};

function EntityQueryFiltersOverlayContent({
  entityKey,
  title,
  open,
  value,
  onClear,
  onClose,
  onExited,
  candidates,
  definitionAvailable,
  definitionError,
  dirty,
  errors,
  initialLoading,
  refreshing,
  rules,
  onClearErrors,
  onRefetch,
  onRulesChange,
  onSubmit,
}: EntityQueryFiltersOverlayContentProps) {
  const { t } = useEntityQueryFiltersTranslation();
  const preferences = sigAppPreferences.value;
  const scopeId = `query-filters:${entityKey}`;
  useUnsavedChangesRegistration({ dirty, enabled: open, scopeId });
  const requestClose = useUnsavedChangesRequestDiscard(onClose, { scopeId });

  const clear = () => {
    onRulesChange([]);
    onClearErrors();
    onClear();
    onClose();
  };

  return (
    <VireoResponsiveOverlayFrame
      aria-label={title}
      open={open}
      onClose={requestClose}
      onExited={onExited}
      desktopSurface={preferences.desktopSurface}
      allowSidePanelResize={preferences.allowSidePanelResize}
      desktopNavWidth={preferences.navigationMode === "compact" ? 80 : preferences.navigationWidth}
      desktopSidePanelWidth={680}
      maxWidth="md"
      mobileMaxHeight="92dvh"
      mobileSurface="bottomDrawer"
    >
      <VireoOverlayHeader title={title} closeLabel={t("overlay.close")} onClose={requestClose} />
      <Box sx={{ bgcolor: "appSurface.recessed", flex: 1, minHeight: 0, overflowY: "auto", p: 2 }}>
        <VireoLoadingRegion loading={initialLoading || refreshing} loadingLabel={t("overlay.loading")}>
          {({ loadingVisible }) => (
            <Box
              data-filter-definition-state={initialLoading ? "loading" : refreshing ? "refreshing" : "settled"}
              sx={{ minHeight: initialLoading ? 240 : 0, position: "relative" }}
            >
              {refreshing && loadingVisible ? (
                <LinearProgress
                  aria-hidden
                  sx={{ height: 2, insetInline: 0, position: "absolute", top: 0, zIndex: 1 }}
                />
              ) : null}
              {initialLoading ? (
                <Box sx={{ display: "grid", minHeight: 240, placeItems: "center" }}>
                  {loadingVisible ? <CircularProgress aria-hidden /> : null}
                </Box>
              ) : definitionError && !definitionAvailable ? (
                <Alert severity="error" action={<Button onClick={onRefetch}>{t("overlay.retry")}</Button>}>
                  {t("overlay.loadError")}
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {definitionError ? (
                    <Alert severity="warning" action={<Button onClick={onRefetch}>{t("overlay.retry")}</Button>}>
                      {t("overlay.staleError")}
                    </Alert>
                  ) : null}
                  <EntityQueryFiltersForm
                    entityKey={entityKey}
                    candidates={candidates}
                    rules={rules}
                    errors={errors}
                    onChange={next => {
                      onRulesChange(next);
                      onClearErrors();
                    }}
                  />
                </Stack>
              )}
            </Box>
          )}
        </VireoLoadingRegion>
      </Box>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          bgcolor: "appSurface.chrome",
          borderTopColor: "divider",
          borderTopStyle: "solid",
          borderTopWidth: 1,
          justifyContent: "flex-end",
          p: 2,
        }}
      >
        <Button disabled={rules.length === 0 && value == null} onClick={clear}>
          {t("overlay.clear")}
        </Button>
        <Button onClick={requestClose}>{t("overlay.cancel")}</Button>
        <Button disabled={!definitionAvailable} variant="contained" onClick={onSubmit}>
          {t("overlay.apply")}
        </Button>
      </Stack>
    </VireoResponsiveOverlayFrame>
  );
}

export function EntityQueryFiltersOverlay({
  entityKey,
  title,
  open,
  value,
  presentation,
  onApply,
  onClear,
  onClose,
  onExited,
}: EntityQueryFiltersOverlayProps) {
  const { t } = useEntityQueryFiltersTranslation();
  const definition = useQuery({ ...QueryEngineQuery.describeEntity(entityKey), enabled: open });
  const candidates = React.useMemo(
    () =>
      definition.data ? createQueryFilterCandidates({ entityKey, definition: definition.data, presentation }) : [],
    [definition.data, entityKey, presentation],
  );
  const form = useVireoForm({
    defaultValues: { rules: [] as QueryFilterRuleDraft[] },
    validators: {
      onSubmit: ({ value: formValue }) => {
        const { errors } = validateQueryFilterDraft(entityKey, formValue.rules, candidates, t);
        return Object.keys(errors).length > 0 ? errors : undefined;
      },
    },
    onSubmit: ({ value: formValue }) => {
      const result = validateQueryFilterDraft(entityKey, formValue.rules, candidates, t);
      onApply(result.document);
      onClose();
    },
  });
  const initializedToken = React.useRef("");
  const token = `${open}:${definition.data?.key ?? "pending"}:${JSON.stringify(value)}`;
  const initialLoading = definition.isPending && !definition.data;
  const refreshing = definition.isFetching && !!definition.data;

  React.useEffect(() => {
    if (!open || !definition.data || initializedToken.current === token) return;
    const next = queryFilterDocumentToDraft(value, candidates);
    form.reset({ rules: next });
    initializedToken.current = token;
  }, [candidates, definition.data, form, open, token, value]);

  return (
    <form.Subscribe
      selector={state => ({
        dirty: state.isDirty,
        errors: (state.errorMap.onSubmit ?? {}) as Record<string, string>,
        rules: state.values.rules,
      })}
    >
      {state => (
        <EntityQueryFiltersOverlayContent
          entityKey={entityKey}
          title={title}
          open={open}
          value={value}
          onClear={onClear}
          onClose={onClose}
          onExited={onExited}
          candidates={candidates}
          definitionAvailable={!!definition.data}
          definitionError={definition.isError}
          dirty={state.dirty}
          errors={state.errors}
          initialLoading={initialLoading}
          refreshing={refreshing}
          rules={state.rules}
          onClearErrors={() => form.setErrorMap({ onSubmit: undefined })}
          onRefetch={() => void definition.refetch()}
          onRulesChange={rules => form.setFieldValue("rules", rules)}
          onSubmit={() => void form.handleSubmit()}
        />
      )}
    </form.Subscribe>
  );
}
