# Verification budget exception — 2026-09-06

Status: **temporary; review by 2026-12-05**.

The offline/SSE implementation materially expanded the browser suite. Every
functional stage passed in both canonical GitHub-hosted Ubuntu 24.04 x64 runs, but
the previous browser and complete-gate limits no longer represented the suite:

| Run                                                                                    | Workers | Browser smoke | Complete gate |
| -------------------------------------------------------------------------------------- | ------: | ------------: | ------------: |
| [33997117734](https://github.com/vireocodedev/vireo-template/actions/runs/33997117734) |       2 |    192,948 ms |    443,295 ms |
| [33997744189](https://github.com/vireocodedev/vireo-template/actions/runs/33997744189) |       3 |    277,824 ms |    533,108 ms |

Both runs used a clean checkout and `npm ci`; ordinary GitHub-hosted npm and Gradle
caches may have been restored. Their retained timing artifacts contain the complete
schema-2 measurements.

## Decision

- Keep two Playwright workers. Three increased contention against the shared test
  backend and made the browser stage 84,876 ms slower.
- Keep the 110-second browser and 300-second complete-gate warning limits so every
  currently slow canonical run remains visible for release review.
- Raise only the browser failure limit from 150 to 270 seconds and the complete-gate
  failure limit from 420 to 620 seconds.
- Keep the 2026-09-01 baselines until five successful comparable runs support a new
  median.

Splitting the offline proof into a weaker lane was rejected because the authoritative
gate must continue proving the complete application. Raising worker count was tested
and rejected by the second run. Removing browser coverage was rejected because the
new journeys exercise cross-tab locking, reload persistence, ordered replay, draft
survival, and short SSE reconnect recovery at their real application seam.

The Vireo Template maintainers own this exception. Review the latest five successful
two-worker canonical artifacts by 2026-12-05 and replace baselines with their
medians. Restore the original 110/150-second browser and 300/420-second complete-gate
limits if every observation fits them. Otherwise, replace this exception with a
reviewed permanent threshold and support-policy revision justified by the five-run
median and range.
