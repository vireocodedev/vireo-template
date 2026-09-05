import type { Mutation, Query, QueryKey } from "@tanstack/react-query";
import { z } from "zod";
import { reportAppError } from "@/app/diagnostics/app-diagnostics";

type ValidationFailureContext =
  { source: "query"; key: QueryKey } | { source: "mutation"; key: readonly unknown[] | undefined };

function reportContractValidationFailure(error: unknown, context: ValidationFailureContext): void {
  if (!(error instanceof z.ZodError)) {
    return;
  }

  reportAppError("API response validation failed.", error, {
    ...context,
    issues: error.issues,
  });
}

export function reportQueryError(error: unknown, query: Query<unknown, unknown, unknown, QueryKey>): void {
  reportContractValidationFailure(error, { source: "query", key: query.queryKey });
}

export function reportMutationError(error: unknown, mutation: Mutation<unknown, unknown, unknown, unknown>): void {
  reportContractValidationFailure(error, {
    source: "mutation",
    key: mutation.options.mutationKey,
  });
}

export function shouldRetryQueryFailure(failureCount: number, error: unknown): boolean {
  return !(error instanceof z.ZodError) && failureCount < 1;
}
