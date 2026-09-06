# Common Template lifecycle

Read for every mode. Mode references add task-specific steps rather than replacing these rules.

## 1. Input and baseline

Record the task/mode, acceptance criteria, repository and revision, allowed paths, requested profiles, and restrictions on writing, execution, network, and external operations. Inspect the worktree without changing it; separate pre-existing/concurrent edits from this task. Do not reset, stash, commit, or overwrite another owner's work to make verification convenient.

Read [root instructions](../../../../AGENTS.md) and the nearest scoped instructions for each affected path. Read current [root scripts](../../../../package.json), [frontend scripts](../../../../frontend/package.json), and the implementation of any proposed command. Derive tooling, package versions, test selectors, and side effects from those files, not examples cached in this harness. A command named dry-run may still access the network, install temporary dependencies, or start services; restrictions apply to those effects too.

Done when the baseline, permitted phase, and success criteria are recorded. Inspection/plan is the default when authority is unclear; absence of approval is not permission.

## 2. Ownership and profiles

Trace **framework → Template → create-vireo projection/upgrade → application**:

- Framework owns reusable APIs, package behavior, and generator/projection/upgrade machinery.
- Template owns source composition and the source assets offered to consumers.
- Projection/upgrade contracts decide what reaches each profile and what existing consumers can safely adopt.
- Applications own product behavior, generated-once/adopted source, migrations, deployments, and data decisions.

Fix at the owning layer. If another repository is needed, report the handoff and merge/release order; extend scope only with user authorization. Never patch a consumer or invent a Template-only projection convention to conceal an upstream gap.

Before any add, edit, move, or deletion, classify **every affected path** for both `full-stack` and `frontend`, including excluded paths and both sides of a move. Use the authoritative create-vireo application projection contract and implementation for the relevant revision, discovered in an authorized framework checkout or an accessible authoritative artifact. The framework marker is `packages/create-vireo/schema/application-projection-contract.json`; CI change routing is a different contract, not a projection classifier.

Record a matrix: source path; profile; authoritative revision/rule; category; disposition; projected destination (or excluded); existing-consumer adoption. Preserve the contract's terms: managed, application-owned, optional, substitution-required, maintainer-only, historical. Exclusion is a disposition, not permission to leave a path unclassified. Inspect destination rewrites and selected optional rules; frontend-only is not just full-stack with JVM checks skipped.

Missing, ambiguous, or inaccessible classification **fails closed** for affected writes and projection claims. An inspection plan may list unresolved rows. Keep maintainer instructions/skills, release policy, provider controls, flagship evidence, and recovery operations excluded from both generated profiles. App-facing guidance has separate source ownership; never move this harness into it. See [generated capabilities](../../../../docs/generated-capabilities.md) and [project upgrades](../../../../docs/project-upgrades.md) for managed versus application-owned adoption.

Done when every path/profile row is resolved or explicitly blocked; do not treat creation coverage as proof of an existing-app upgrade edge.

## 3. Dependencies and release intent

Published dependencies are always the default for frontend and JVM. Read [local development](../../../../docs/local-starter-development.md) and actual launcher/resolution configuration before an explicitly authorized integration experiment. Discover the framework path from user input or workspace markers, never a hardcoded sibling directory. A nearby checkout, unpublished fix, failed build, or missing public artifact is not consent to local mode.

Before local mode, capture TypeScript references, manifests/lockfiles, environment/property overrides, local repositories, and processes. Keep the experiment bounded; record source versus emitted-output consumption. On success, failure, or interruption, restore only task-owned temporary changes and processes to the recorded baseline, then confirm the dependency resolution state. Never overwrite a user's pre-existing local-mode edit. If the baseline was local or cannot be restored safely, report that explicitly; a published-dependency check remains pending and no release-compatible claim follows from local success.

Ordinary plan/change/fix/docs work does not bump versions, move Template/CLI pins, rewrite release bindings, or invent upgrade edges. Explicit release intent routes those proposals to [release / operate](./release-operate.md); proposed versions still require exact approval before applying them. Read the live [compatibility contract](../../../../contracts/vireo-package-compatibility.json) and [release policy](../../../../contracts/template-release-policy.json) rather than assuming all packages share a version.

Done when the dependency baseline, any authorized exception/restoration, and release intent are explicit.

## 4. Execution and evidence

Use the selected mode's bounded actions. Verification follows [verify mode](./verify.md): focused checks first when permitted, full suites coordinated sequentially across the workstation and repositories. Respect a request for no tests/builds/installs; report the gap instead of running a policy script or fixture under another label. Inspect command bodies before execution and retain exact command, revision, profile, dependency mode, environment, and result.

Keep claims separate:

| Claim            | Required evidence                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Source           | Exact worktree diff or source revision; not automatically available to consumers                                           |
| Public/published | Exact immutable release/artifact, Template and CLI pin, and provenance; a manifest declaration alone is insufficient       |
| Tested           | Actual command/run result tied to revision, profile, dependency mode, and environment; state failures and skipped coverage |

A local integration pass is not public-package compatibility. A source policy pass is not a clean-consumer projection pass. An old hosted success or unrun test is not evidence for today's diff. Current documentation must distinguish these states; [docs mode](./docs.md) governs immutable historical pins.

## 5. Stop and approval boundaries

Pause affected actions and report the needed owner/decision when scope conflicts, projection coverage is unresolved, required inputs are missing, another worker changes the same path, a public dependency is unavailable, or a prerequisite gate fails. Never suppress a failing test/policy, weaken a hosted gate, or substitute an unapproved environment to get a green result.

User approval must identify the actual action and target before:

- Database destruction/reset, irreversible migration/data repair, volume removal, or restore over existing data. Establish backup/restore and recovery evidence first; keep used Flyway migrations append-only and runtime credentials separate from schema-owner credentials.
- OPFS/cache/queue deletion, forced logout/user-switch cleanup, or conflict resolution that discards pending work. Preserve diagnostic evidence and describe data loss. Existing user-confirmed product behavior is not blanket permission for agent-driven cleanup.
- Capability ejection, adopting/overwriting customized managed files, or accepting application-owned migration work. These transfer ownership or discard protections; never use them automatically to fix a failing generator/check.
- Release/tag/publish/deploy or provider/secret/settings mutation. Apply the exact-action/artifact/target approval in [release / operate](./release-operate.md); generic readiness or release intent is not operational consent.

Keep secrets out of prompts, logs, diffs, and receipts; request secret entry only through approved operator interfaces. Skills guide decisions; they are not a security enforcement layer and cannot substitute for sandboxing, tool permissions, provider protection, or hosted checks. Missing authority is a stop, not a reason to escape those controls.

## Finish receipt

Every mode, including blocked or read-only work, ends with:

- **Outcome:** mode, requested result, achieved result, and status (completed, inspection-only, partial, or blocked).
- **Files:** exact task-owned files changed; read-only modes say none. Summarize path/profile ownership impact and distinguish pre-existing changes.
- **Verification actually run:** commands or static inspections, outcomes, revision/profile/dependency mode/environment, and evidence locations; say none when none ran.
- **Skipped:** checks not run and why, including clean-consumer/public/hosted/manual coverage. Never mark planned work passed.
- **Risks:** unresolved findings, compatibility/adoption work, data or operational risks, and any unrestored temporary state.
- **Pending manual approvals:** exact action/artifact/target, required owner, missing inputs, and next step; say none only when none remain.
