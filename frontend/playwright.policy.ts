export const parallelPlaywrightPolicy = {
  expect: { timeout: 5_000 },
  forbidOnly: true,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  // Bound local and CI concurrency because every journey mutates the same test backend.
  workers: 2,
} as const;

export const serialPlaywrightPolicy = {
  ...parallelPlaywrightPolicy,
  fullyParallel: false,
  workers: 1,
} as const;
