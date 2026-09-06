# Using Vireo application skills

Start Codex in the application you want to change. Use `$vireo-app` followed by a
mode and the outcome in your own words. Paths and names below are illustrative;
the skill discovers your profile, scripts, and installed capabilities each time.

```text
$vireo-app plan Add an approval step to purchase orders; compare options, no edits.
$vireo-app feature Add an accessible status filter to the orders list with focused tests.
$vireo-app fix Login reaches an unconfigured adapter; reproduce and fix bootstrap wiring.
$vireo-app review Review my uncommitted order changes against the supplied issue; no writes.
$vireo-app docs Document the current offline conflict choices for support staff.
$vireo-app verify Run only the focused checks for my order validation changes.
$vireo-app generate Plan an entity from my schema and show the dry-run before writing.
$vireo-app upgrade Plan a move to the exact target release I provide; do not apply it.
$vireo-app operate Assess staging readiness and list gaps; do not deploy or reset data.
```

## What to include

- **Outcome:** observable behavior or question, not a list of imagined commands.
- **Scope:** application, area, diff base/spec for review, or schema for generation.
- **Constraints:** plan-only, files to preserve, no tests, or a focused check budget.
- **Operations:** for planning, name the environment if known. Before any execution,
  identify the exact artifact/environment, intended effects, and recovery permission.
  "Ship it" is not a complete deployment authorization.

An implementation request permits ordinary scoped edits and focused checks; it does
not require confirmation for each ordinary change. Plans and reviews remain
read-only unless you ask for a written artifact or explicitly scoped checks. If you
want a plan saved, give an application-owned destination. Existing unrelated changes
remain yours; the skill will not clean the repository to simplify its work.

## Direct specialists

You can also explicitly use `$vireo-app-feature-author`, `$vireo-app-generate`,
`$vireo-app-upgrader`, `$vireo-app-production-readiness`, or `$vireo-app-operate`.
Each reads [the same workflow](workflow.md). The router explicitly reads and follows
the selected specialist's instructions rather than assuming skill auto-loading.

`$vireo-app-operate` is explicit-invocation only. The router may read it for an
explicit `operate` request, but reading its instructions grants no deployment or
recovery permission. Production-readiness review remains an assessment, not deploy.

## Availability and limits

The portable entry point is `$vireo-app`. A separately configured personal `$vireo`
router may delegate here; it is optional and is not installed by this consumer tree.
If Codex does not discover the skill, check that the application has
`.agents/skills/vireo-app/SKILL.md` and reopen the session at its root. Frontend and
full-stack projections both place consumer skills at `.agents/skills/`; neither
requires a nested `.vireo/application/` skill path after creation.

Older applications may have no skills, incomplete provenance, or unsupported CLI
capabilities. Presence of a skill does not upgrade the application or establish a
supported release edge. Use the discovered contracts or a manual plan; never invent
metadata to make a command accept an unsupported application.

No connected service, personal skill, or specialized agent is needed. Supply issue
or deployment evidence as ordinary text if necessary, without secrets. Enter
credentials only directly in a terminal/provider interface. Skills are instructions,
not permission enforcement or a promise to finish without human decisions.

Expect a receipt listing actual changes, checks and output, skipped work, ownership,
and approvals still needed. For shared rules, read [the workflow](workflow.md); for
behavioral evaluation, read [the scenarios](evaluation-scenarios.md). Command
inventories remain in the application scripts and version-matched CLI help.