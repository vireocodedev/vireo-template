export const parallelPlaywrightPolicy = {
  expect: { timeout: 5_000 },
  forbidOnly: true,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  // Bound concurrency because every browser journey shares the same test backend.
  workers: 2,
} as const;

export const serialPlaywrightPolicy = {
  ...parallelPlaywrightPolicy,
  fullyParallel: false,
  workers: 1,
} as const;
