export const parallelPlaywrightPolicy = {
  expect: { timeout: 5_000 },
  forbidOnly: true,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  // Bound concurrency to limit contention; CI's multi-core runner needs one extra worker to stay inside its hard cap.
  workers: process.env.CI ? 3 : 2,
} as const;

export const serialPlaywrightPolicy = {
  ...parallelPlaywrightPolicy,
  fullyParallel: false,
  workers: 1,
} as const;
