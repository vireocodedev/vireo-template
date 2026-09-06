import type { QueryEngineFieldDefinition, QueryEngineOperator } from "@vireocodedev/query";
import {
  buildValidatedQueryFilterDocumentSchema,
  type QueryFilterDocument,
} from "@/app/data/query/models/QueryFilterDocument";
import type {
  EntityQueryFilterContext,
  EntityQueryFilterPresentation,
  QueryFilterCandidate,
  QueryFilterDraftValidation,
  QueryFilterDraftValue,
  QueryFilterRuleDraft,
} from "../models/EntityQueryFilters";
import type { QueryFilterRow } from "@/app/data/query/models/QueryFilterDocument";
import type { TFunction } from "i18next";
import type { ENTITY_QUERY_FILTERS_TRANSLATION_NAMESPACE } from "@/app/app.localization";

type EntityQueryFiltersT = TFunction<typeof ENTITY_QUERY_FILTERS_TRANSLATION_NAMESPACE>;

const NULLARY_OPERATORS = new Set<QueryEngineOperator>(["IS_NULL", "IS_NOT_NULL"]);

const QUERY_RESULT_COUNT_UNITS = [
  { threshold: 1_000_000_000_000, suffix: "T" },
  { threshold: 1_000_000_000, suffix: "B" },
  { threshold: 1_000_000, suffix: "M" },
  { threshold: 1_000, suffix: "k" },
] as const;

export function getQueryFilterOperatorLabel(t: EntityQueryFiltersT, operator: QueryEngineOperator): string {
  return t(`operators.${operator}`);
}

export function createQueryFilterCandidates({
  definition,
  presentation,
}: EntityQueryFilterContext): QueryFilterCandidate[] {
  const candidates: QueryFilterCandidate[] = [];

  const visit = (field: QueryEngineFieldDefinition) => {
    const override = presentation?.fields?.[field.path];
    if (field.relation && (field.relationMode === "SELECTION" || field.relationMode === "BOTH")) {
      candidates.push({
        id: `relation:${field.path}`,
        path: field.path,
        label: override?.label ?? readableLabel(field.label, field.path),
        type: "RELATION",
        operators: [],
        enumValues: [],
        enumLabels: {},
        relation: true,
        multiple: field.multiple,
      });
    }
    if (!field.relation && field.operators.length > 0) {
      candidates.push({
        id: `leaf:${field.path}`,
        path: field.path,
        label: override?.label ?? readableLabel(field.label, field.path),
        type: field.type,
        operators: field.operators,
        enumValues: field.enumValues,
        enumLabels: override?.enumLabels ?? {},
        relation: false,
        multiple: field.multiple,
      });
    }
    field.children.forEach(visit);
  };

  definition.fields.forEach(visit);
  return candidates;
}

export function createQueryFilterRule(
  candidate: QueryFilterCandidate,
  id: string = crypto.randomUUID(),
): QueryFilterRuleDraft {
  const operator = candidate.relation ? null : (candidate.operators[0] ?? null);
  return {
    id,
    candidateId: candidate.id,
    operator,
    value: createDefaultDraftValue(candidate, operator),
  };
}

export function updateQueryFilterRuleCandidate(
  rule: QueryFilterRuleDraft,
  candidate: QueryFilterCandidate,
): QueryFilterRuleDraft {
  const operator = candidate.relation ? null : (candidate.operators[0] ?? null);
  return { ...rule, candidateId: candidate.id, operator, value: createDefaultDraftValue(candidate, operator) };
}

export function updateQueryFilterRuleOperator(
  rule: QueryFilterRuleDraft,
  candidate: QueryFilterCandidate,
  operator: QueryEngineOperator,
): QueryFilterRuleDraft {
  return { ...rule, operator, value: createDefaultDraftValue(candidate, operator) };
}

export function queryFilterDocumentToDraft(
  document: QueryFilterDocument | null,
  candidates: QueryFilterCandidate[],
): QueryFilterRuleDraft[] {
  if (!document) return [];
  return document.rows.map((row, index) => {
    const candidateId = `${row.kind}:${row.path}`;
    const candidate = candidates.find(item => item.id === candidateId);
    const id = `committed-${index}`;
    if (!candidate) {
      return { id, candidateId, operator: row.operator, value: { kind: "scalar", value: row.value } };
    }
    if (row.kind === "relation") {
      return { id, candidateId, operator: null, value: { kind: "relation", options: row.selectedOptions } };
    }
    if (row.operator === "DATE_RANGE") {
      const [from = "", to = ""] = row.value.split("|", 2);
      return { id, candidateId, operator: row.operator, value: { kind: "dateRange", from, to } };
    }
    if (row.operator === "IN") {
      return {
        id,
        candidateId,
        operator: row.operator,
        value: {
          kind: "multiple",
          values: row.value
            .split(",")
            .map(value => value.trim())
            .filter(Boolean),
        },
      };
    }
    if (candidate.type === "BOOLEAN") {
      return {
        id,
        candidateId,
        operator: row.operator,
        value: { kind: "boolean", value: row.value === "true" ? true : row.value === "false" ? false : null },
      };
    }
    if (NULLARY_OPERATORS.has(row.operator)) {
      return { id, candidateId, operator: row.operator, value: { kind: "none" } };
    }
    return { id, candidateId, operator: row.operator, value: { kind: "scalar", value: row.value } };
  });
}

export function validateQueryFilterDraft(
  entityKey: EntityQueryFilterContext["entityKey"],
  rules: QueryFilterRuleDraft[],
  candidates: QueryFilterCandidate[],
  t: EntityQueryFiltersT,
): QueryFilterDraftValidation {
  const errors: Record<string, string> = {};
  const rows: QueryFilterRow[] = [];
  rules.forEach(rule => {
    const candidate = candidates.find(item => item.id === rule.candidateId);
    if (!candidate) {
      errors[rule.id] = t("validation.unavailableField");
      return;
    }
    if (!candidate.relation && (!rule.operator || !candidate.operators.includes(rule.operator))) {
      errors[rule.id] = t("validation.operator");
      return;
    }

    const value = toCanonicalValue(rule.value);
    if (candidate.relation && rule.value.kind === "relation") {
      if (rule.value.options.length === 0) errors[rule.id] = t("validation.relation");
      rows.push({
        kind: "relation" as const,
        path: candidate.path,
        operator: null,
        value: "",
        parameterized: false as const,
        selectedOptions: rule.value.options,
      });
      return;
    }
    if (!rule.operator) return;
    if (!NULLARY_OPERATORS.has(rule.operator) && !value.trim()) errors[rule.id] = t("validation.value");
    if (rule.operator === "DATE_RANGE" && rule.value.kind === "dateRange" && !rule.value.from && !rule.value.to) {
      errors[rule.id] = t("validation.dateRange");
    }
    rows.push({
      kind: "leaf" as const,
      path: candidate.path,
      operator: rule.operator,
      value,
      parameterized: false as const,
      selectedOptions: [],
    });
  });

  if (Object.keys(errors).length > 0) return { document: null, errors };
  const parsed = buildValidatedQueryFilterDocumentSchema(t).safeParse({ entity: entityKey, rows });
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const rowIndex = typeof issue.path[1] === "number" ? issue.path[1] : 0;
      const rule = rules[rowIndex];
      if (rule) errors[rule.id] = issue.message;
    }
    return { document: null, errors };
  }
  return { document: parsed.data.rows.length === 0 ? null : parsed.data, errors };
}

export function formatQueryFilterRowSummary(
  row: QueryFilterRow,
  t: EntityQueryFiltersT,
  presentation?: EntityQueryFilterPresentation,
): string {
  const fieldPresentation = presentation?.fields?.[row.path];
  const fieldLabel = fieldPresentation?.label ?? readableLabel("", row.path);

  if (row.kind === "relation") {
    return `${fieldLabel} · ${t("summary.relationOperator")} · ${row.selectedOptions.map(option => option.label).join(", ")}`;
  }

  const operatorLabel = t(`summary.operators.${row.operator}`);
  if (NULLARY_OPERATORS.has(row.operator)) return `${fieldLabel} · ${operatorLabel}`;

  return `${fieldLabel} · ${operatorLabel} · ${formatSummaryValue(row, t, fieldPresentation?.enumLabels)}`;
}

export function formatQueryResultCount(count: number, locale?: string): string {
  const normalizedCount = Math.max(0, Math.trunc(count));
  if (normalizedCount < 10_000) return normalizedCount.toLocaleString(locale);

  const unit = QUERY_RESULT_COUNT_UNITS.find(candidate => normalizedCount >= candidate.threshold);
  if (!unit) return normalizedCount.toLocaleString(locale);

  const compactCount = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    normalizedCount / unit.threshold,
  );
  return `${compactCount}${unit.suffix}+`;
}

function createDefaultDraftValue(
  candidate: QueryFilterCandidate,
  operator: QueryEngineOperator | null,
): QueryFilterDraftValue {
  if (candidate.relation) return { kind: "relation", options: [] };
  if (operator && NULLARY_OPERATORS.has(operator)) return { kind: "none" };
  if (operator === "DATE_RANGE") return { kind: "dateRange", from: "", to: "" };
  if (operator === "IN") return { kind: "multiple", values: [] };
  if (candidate.type === "BOOLEAN") return { kind: "boolean", value: null };
  return { kind: "scalar", value: "" };
}

function toCanonicalValue(value: QueryFilterDraftValue): string {
  switch (value.kind) {
    case "scalar":
      return value.value.trim();
    case "boolean":
      return value.value == null ? "" : String(value.value);
    case "multiple":
      return value.values
        .map(item => item.trim())
        .filter(Boolean)
        .join(",");
    case "dateRange":
      return `${value.from.trim()}|${value.to.trim()}`;
    case "relation":
    case "none":
      return "";
  }
}

function formatSummaryValue(
  row: Extract<QueryFilterRow, { kind: "leaf" }>,
  t: EntityQueryFiltersT,
  enumLabels?: Record<string, string>,
): string {
  if (row.operator === "DATE_RANGE") {
    const [from = "", to = ""] = row.value.split("|", 2);
    if (from && to) return `${from} – ${to}`;
    if (from) return t("summary.from", { value: from });
    if (to) return t("summary.through", { value: to });
  }

  const values = row.operator === "IN" ? row.value.split(",") : [row.value];
  return values
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => enumLabels?.[value] ?? formatBooleanSummaryValue(value, t))
    .join(", ");
}

function formatBooleanSummaryValue(value: string, t: EntityQueryFiltersT): string {
  if (value === "true") return t("form.yes");
  if (value === "false") return t("form.no");
  return value;
}

function readableLabel(metadataLabel: string, path: string): string {
  const raw = metadataLabel.includes(".") ? metadataLabel.split(".").at(-1)! : metadataLabel || path.split(".").at(-1)!;
  const words = raw.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
