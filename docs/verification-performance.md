# Verification performance policy

The authoritative gate records wall-clock duration and GNU time peak resident set
size for all five stages. The machine policy is
[`contracts/verification-budget-policy.json`](../contracts/verification-budget-policy.json);
CI retains each run's `.verification-evidence/latest.json` for 90 days.

## Comparable evidence

- **Canonical host:** GitHub-hosted Ubuntu 24.04 x86-64.
- **Cache state:** clean checkout and `npm ci`; ordinary hosted Gradle/npm caches may
  be restored, and each artifact records the observed runner image.
- **Duration:** one wall-clock measurement per stage and for the complete gate.
- **Memory:** GNU time maximum RSS in KiB for each stage process tree; complete-gate
  peak RSS is the maximum stage value rather than a sum.
- **Baseline method:** the checked-in initial verified reference is replaced by the
  median of the latest five successful canonical-host runs when five comparable
  artifacts exist.

Measurements from heterogeneous developer hosts remain diagnostic and cannot change
the canonical baseline.

## Production browser budgets

`cd frontend && corepack npm run performance:audit` runs three independent
Lighthouse samples using the default mobile emulation against the production
`/login` bundle. The preview server is shared, but each sample starts a fresh
headless Chrome process. CI retains the structured, schema-versioned
`.performance-evidence/lighthouse.json` artifact for 90 days. It includes every
raw sample, its automated accessibility findings, the aggregation policy, and the
gate result. On a failed Chrome, Lighthouse, or policy-validation attempt, the
same schema records `status: "failed"`, the completed samples, and a sanitized
error summary before the audit exits.

Performance and timing metrics use the median of the three samples. Accessibility
and best-practices use the minimum sample score: a single regression fails the
gate. Each timing maximum is also a raw per-sample hard cap, so an extreme timing
result cannot be hidden by an otherwise passing median. The merge gate enforces:

| Metric                    |           Budget |
| ------------------------- | ---------------: |
| Lighthouse performance    |    at least 0.75 |
| Lighthouse accessibility  |     exactly 1.00 |
| Lighthouse best practices |    at least 0.90 |
| First Contentful Paint    | at most 4,000 ms |
| Largest Contentful Paint  | at most 5,000 ms |
| Total Blocking Time       |   at most 500 ms |
| Cumulative Layout Shift   |     at most 0.10 |

Equality passes every threshold. A one-off performance-score outlier may pass when
the median meets its budget and no raw hard cap is crossed; two regressed samples
that lower the median fail. The deterministic Lighthouse policy test covers those
cases and the single-sample accessibility, best-practices, and timing hard-cap
failures before the browser audit runs.

The existing production build also limits the largest JavaScript chunk to 700 KiB
and total JavaScript to 2,500 KiB before compression. The total includes the offline
showcase's separately loaded application SQLite Worker and WASM bootstrap. These are
regression budgets for the unmodified canonical Template, not field-performance or
application-page promises. Network proximity, deployment compression/CDN behavior,
application data, third-party code, and device capability remain
application/deployment variables.

Physical low-end and real-user field measurements remain open manual evidence in
the [platform checklist](manual-platform-checklist.md).

## Thresholds

| Stage             | Duration warning | Duration failure | RSS warning | RSS failure |
| ----------------- | ---------------: | ---------------: | ----------: | ----------: |
| Public contract   |              5 s |             10 s |     256 MiB |     512 MiB |
| Frontend contract |            180 s |            240 s |       6 GiB |       8 GiB |
| Browser smoke     |            110 s |            270 s |       3 GiB |       4 GiB |
| JVM build         |             90 s |            120 s |     1.5 GiB |       2 GiB |
| Container context |              5 s |             10 s |     256 MiB |     512 MiB |
| Complete gate     |            300 s |            620 s |       6 GiB |       8 GiB |

The 2026-09-01 five-run review replaces every stage and complete-gate baseline with
the five-run median, including a complete-gate baseline of 230.245 seconds
and 2.65 GiB peak RSS; the frontend-contract baseline is 166.632 seconds and 2.65
GiB peak RSS. The browser and complete-gate failure limits have a temporary exception
for the expanded offline/SSE browser suite; their baselines and warning limits remain
unchanged until five successful comparable runs exist. A warning keeps the gate green
but requires review before release; a failure threshold fails the gate. See the
[`2026-09-06 budget exception`](verification-budget-exception-2026-09-06.md) and the
[`2026-09-01 trend review`](verification-trend-review-2026-09-01.md).

## Baseline review and exceptions

Review the latest five canonical artifacts before changing a threshold. Use their
median and range, identify whether cache state or hosted-runner changes explain the
movement, and optimize or split work before increasing a limit.

A threshold increase requires a reviewed change recording:

1. the affected stage and canonical run artifacts;
2. the five-run median, range, and cache state;
3. the product or dependency change that caused the increase;
4. optimization or lane-splitting alternatives considered;
5. the smallest justified new warning/failure values; and
6. an owner and review date no more than 90 days later.

Emergency exceptions must be time-bounded, retain the failed evidence, and name the
condition that restores the original threshold or publicly revises the affected
support claim.
