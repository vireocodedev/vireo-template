import type { Mutation, Query, QueryKey } from "@tanstack/react-query";
import { z } from "zod";
import { reportAppError } from "../../../diagnostics/app-diagnostics";

type ValidationFailureContext =
  { source: "query"; key: QueryKey } | { source: "mutation"; key: readonly unknown[] | undefined };

function reportApiFailure(error: unknown, context: ValidationFailureContext): void {
  const validationFailure = error instanceof z.ZodError;
  reportAppError(validationFailure ? "API response validation failed." : "API request failed.", error, {
    ...context,
    ...(validationFailure ? { issues: error.issues } : {}),
  });
}

export function reportQueryError(error: unknown, query: Query<unknown, unknown, unknown, QueryKey>): void {
  reportApiFailure(error, { source: "query", key: query.queryKey });
}

export function reportMutationError(error: unknown, mutation: Mutation<unknown, unknown, unknown, unknown>): void {
  reportApiFailure(error, {
    source: "mutation",
    key: mutation.options.mutationKey,
  });
}

export function shouldRetryQueryFailure(failureCount: number, error: unknown): boolean {
  return !(error instanceof z.ZodError) && failureCount < 1;
}
