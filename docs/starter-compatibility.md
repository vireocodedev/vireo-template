# Starter compatibility, upgrades, and bundle policy

The template's ordinary install, development, test, Storybook, and production-build commands consume released Vireo Starter packages from their public registries. Local Starter source and distribution aliases are explicit development modes and must never become an implicit production dependency.

## Published package line

| Package                        | Supported line |
| ------------------------------ | -------------- |
| `@vireocodedev/ui`             | `^0.3.2`       |
| `@vireocodedev/query`          | `^0.2.2`       |
| `@vireocodedev/shell`          | `^0.2.2`       |
| `@vireocodedev/history`        | `^0.2.2`       |
| `@vireocodedev/infrastructure` | `^0.3.0`       |
| `@vireocodedev/localization`   | `^0.2.2`       |
| `@vireocodedev/sqlite`         | `^0.2.3`       |
| Vireo Starter JVM modules      | `0.4.0`        |

The lockfiles are the reproducibility boundary. Updating a supported package range still requires reviewing and committing the resulting lockfile changes and passing the authoritative verification command.

The npm and JVM version numbers are independent and do not need to match. This
repository revision, its declared ranges, `starterVersion`, and committed lockfiles
form the compatibility manifest for the exact combination demonstrated here. The
upstream [Vireo compatibility policy](https://github.com/vireocodedev/vireo/blob/main/docs/COMPATIBILITY.md)
defines artifact SemVer, public-contract boundaries, deprecation windows, and
release-line support.

Only the latest Template release and `main` receive fixes and security updates.
The immediately prior release remains an admitted source for its one declared
adjacent upgrade, but that upgrade-source window is not a backport or a promise of
ongoing fixes. Older tags remain reference points. A dependency range permits
compatible releases under SemVer; it does not claim that every possible transitive
combination has been tested.

## Application upgrade contract

A cloned application is not kept current automatically. `vireo upgrade` provides a
version-aware migration only for explicitly supported release-pair surfaces; the
Template's file layout is not a stable library API. Application owners selectively
merge or port upstream changes and remain responsible for domain code, database
migrations, configuration, generated code, and deployment order. See the
[project-upgrade contract](project-upgrades.md).

For an upgrade:

1. Run the target CLI's upgrade dry run and resolve every refusal.
2. Compare the current Template revision with the intended tag or commit.
3. Read affected Vireo changelogs and upstream migration or deprecation notes.
4. Update npm ranges, `starterVersion`, and both lockfiles deliberately.
5. Apply application-owned configuration, schema, data, or source migrations.
6. Run `./scripts/verify.sh`, then verify the deployment and rollback sequence in an
   application-owned environment.

A cross-stack change that cannot tolerate mixed frontend/backend versions requires
an explicit deployment order. Do not infer wire, schema, or generated-code
compatibility merely because both halves build independently.

### Item UUID migration deployment

`V4__migrate_item_ids_to_uuid.sql` is a forward-only application migration for
an existing numeric `item` table. It deterministically remaps each Item to an
RFC 4122 version-4 UUID, sets the first optimistic version to `0`, and rewrites
the retained Item history row ID and non-redacted JSON snapshot `id`/`version`
fields to that shape. It has no safe down migration: an older binary expecting
numeric IDs must never start against the migrated database.

Before deploying it, drain Item writes and offline replay, take and verify a
restoreable backup, rehearse the exact production data volume, and deploy the
matching backend and frontend as one maintenance-window release. Validate Item
reads, writes, history, SSE, and offline replay before accepting traffic. If
cutover fails after Flyway applies V4, rollback means restoring the pre-migration
database or completing a reviewed forward fix; it does not mean routing traffic
to the prior application version.

Toolchain and workflow policy are checked inside the authoritative frontend gate.
Recurring Java, browser, and PostgreSQL compatibility evidence is described in
[Platform support evidence](platform-support-evidence.md).

## Local Starter development

Use `corepack npm run dev:local-starter` only when changing Starter and this template together. Use `corepack npm run dev` to prove the published-consumer experience. See [Developing against local Starter libraries](local-starter-development.md) for the complete mode matrix.

`corepack npm run starter:boundary:check` prevents published commands and TypeScript configuration from silently depending on a sibling Starter checkout.

## Bundle budgets

Every production application build enforces two raw JavaScript budgets:

| Measurement              |    Budget |
| ------------------------ | --------: |
| Largest emitted chunk    |   700 KiB |
| Total emitted JavaScript | 2,500 KiB |

These are regression tripwires, not performance targets. The total budget includes
the offline showcase's separately loaded application SQLite Worker and WASM
bootstrap. If another feature requires increasing a budget, document the reason and
review the loading behavior before changing it. Prefer route-level loading and
dependency reduction over merely increasing a limit.
