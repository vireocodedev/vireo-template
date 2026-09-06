import type {
  QueryEngineEntityDefinition,
  QueryEngineFieldType,
  QueryEngineOperator,
  QueryEngineRelationOption,
} from "@vireocodedev/query";
import type { AppQueryEntityKey } from "@/app/data/query/models/AppQueryEntityKey";
import type { QueryFilterDocument, QueryFilterRow } from "@/app/data/query/models/QueryFilterDocument";

export type QueryFilterFieldPresentation = {
  label?: string;
  enumLabels?: Record<string, string>;
};

export type EntityQueryFilterPresentation = {
  fields?: Record<string, QueryFilterFieldPresentation>;
};

export type QueryFilterCandidate = {
  id: string;
  path: string;
  label: string;
  type: QueryEngineFieldType;
  operators: QueryEngineOperator[];
  enumValues: string[];
  enumLabels: Record<string, string>;
  relation: boolean;
  multiple: boolean;
};

export type QueryFilterDraftValue =
  | { kind: "scalar"; value: string }
  | { kind: "boolean"; value: boolean | null }
  | { kind: "multiple"; values: string[] }
  | { kind: "dateRange"; from: string; to: string }
  | { kind: "relation"; options: QueryEngineRelationOption[] }
  | { kind: "none" };

export type QueryFilterRuleDraft = {
  id: string;
  candidateId: string;
  operator: QueryEngineOperator | null;
  value: QueryFilterDraftValue;
};

export type QueryFilterDraftValidation = {
  document: QueryFilterDocument | null;
  errors: Record<string, string>;
};

export type EntityQueryFilterContext = {
  entityKey: AppQueryEntityKey;
  definition: QueryEngineEntityDefinition;
  presentation?: EntityQueryFilterPresentation;
};

export type CanonicalFilterRow = QueryFilterRow;
