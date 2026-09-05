import { parallelPlaywrightPolicy, serialPlaywrightPolicy } from "../../playwright.policy";
import { describe, expect, it } from "vitest";

describe("Playwright execution policy", () => {
  it("fails focused tests and bounds shared-backend browser concurrency", () => {
    expect(parallelPlaywrightPolicy).toEqual({
      expect: { timeout: 5_000 },
      forbidOnly: true,
      fullyParallel: true,
      retries: process.env.CI ? 1 : 0,
      timeout: 30_000,
      workers: process.env.CI ? 3 : 2,
    });
    expect(serialPlaywrightPolicy).toEqual({
      ...parallelPlaywrightPolicy,
      fullyParallel: false,
      workers: 1,
    });
  });
});
