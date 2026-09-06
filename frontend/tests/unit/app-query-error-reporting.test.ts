import {
  reportMutationError,
  reportQueryError,
  shouldRetryQueryFailure,
} from "@/app/data/network/services/appQueryErrorReporting";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

describe("application query error reporting", () => {
  it("logs Zod response failures with their query key and issues", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new z.ZodError([
      {
        code: "invalid_type",
        expected: "string",
        path: [0, "actor"],
        message: "Invalid input: expected string, received undefined",
      },
    ]);

    reportQueryError(error, { queryKey: ["history", "ITEM", "1"] } as never);

    expect(consoleError).toHaveBeenCalledWith(
      "API response validation failed.",
      expect.objectContaining({
        source: "query",
        key: ["history", "ITEM", "1"],
        issues: error.issues,
        error,
      }),
    );
    consoleError.mockRestore();
  });

  it("logs transport errors and does not retry validation failures", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const transportError = new Error("Network unavailable");
    const validationError = new z.ZodError([]);

    reportMutationError(transportError, { options: { mutationKey: ["save-item"] } } as never);

    expect(consoleError).toHaveBeenCalledWith(
      "API request failed.",
      expect.objectContaining({ source: "mutation", key: ["save-item"], error: transportError }),
    );
    expect(shouldRetryQueryFailure(0, validationError)).toBe(false);
    expect(shouldRetryQueryFailure(0, transportError)).toBe(true);
    expect(shouldRetryQueryFailure(1, transportError)).toBe(false);
    consoleError.mockRestore();
  });
});
