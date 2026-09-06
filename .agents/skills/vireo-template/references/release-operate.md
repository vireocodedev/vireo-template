# Release / operate mode

**Input:** inspection/preparation/publication/recovery/deployment intent, exact repository/source revision, proposed release/artifact, target environment/account, and allowed read/write operations. Apply the [common workflow](./workflow.md). Both aliases start with **plan/inspection**, not an implicit dispatch or mutation.

## 1. Discover the owning guidance

Read Template-owned [release preparation](../../../../docs/template-release-preparation.md), [operations](../../../../docs/operations.md), [deployment](../../../../docs/deployment.md), and the current [release policy](../../../../contracts/template-release-policy.json) plus [artifact contract](../../../../contracts/template-release-artifacts.json). For incidents/recovery, also read [incident response](../../../../docs/incident-response.md), [database recovery](../../../../docs/database-recovery.md), and, for the flagship only, [demo operations](../../../../docs/flagship-demo.md).

Discover a framework checkout from a user-supplied path or candidate repositories already in the authorized workspace. Validate root package/workspace metadata and markers such as `packages/create-vireo/package.json` and `packages/create-vireo/schema/application-projection-contract.json`. A directory name or remote label alone is insufficient. Never hardcode a sibling `starter` directory, assume an adjacent layout from a runbook example, or scan outside the authorized roots. If candidates disagree or access is unclear, ask for the intended path/read authorization.

If that framework checkout is authorized for reading and contains `.agents/skills/vireo-release-operator/SKILL.md`, **open and read it explicitly**, together with its applicable repository instructions and required references. A skill's availability in another repository does not auto-load it here. Reading it grants no framework write or operation authority.

If the checkout/skill is absent, inaccessible, or unauthorized, continue only with the Template-owned runbooks above and report **framework release guidance missing/unread** with the reason. Produce a bounded Template inspection/plan; leave framework publication and any step needing its policy blocked. Do not invent the missing policy or treat absence as a waiver. Done when the evidence identifies the guidance actually read and all missing owners/inputs.

## 2. Bind the plan to exact artifacts

Inspect current package scripts, workflow definitions, policy inputs, compatibility, provenance, and provider-control requirements. Separate source-ready, publicly available, qualified, and deployed states. Read-only registry/provider inspection still needs authorized access; do not log credentials. A default-dry-run preparation command may install an isolated consumer for attestation checks, so inspect its effects before executing it.

For a new release, sequence approved framework artifacts → Template preparation/qualification → protected Template release → paired CLI/projection availability → consumer adoption as required by the current runbooks. Do not collapse independently versioned coordinates into one guessed version. For recovery, bind to the exact existing immutable tag/artifact and its policy; newer current-branch metadata must not rewrite that historical contract. Resolve mismatches through the supported recovery workflow, not replacement tags/artifacts.

Done when the plan names the exact source, coordinates, artifact digests/provenance, target, required hosted gates, and missing public/projection evidence. Without release intent, version bumps and Template/CLI pin changes remain out of scope.

## 3. Approval checkpoint

Before **each** write or dispatch, obtain explicit user approval for:

- **Action:** prepare/apply, tag, publish, reconcile, deploy, reset, or provider/secret/settings mutation; approving one does not approve the next.
- **Release/artifact:** exact repository and source commit/tag, package coordinates/versions, immutable artifact/digest or exact preparation inputs and expected changed paths.
- **Target:** registry/repository, environment, provider account/project/resource, or database/browser storage owner; include expected impact and recovery/rollback limits.
- **Execution:** supported workflow/entry point and inputs, permission boundary, and prerequisites. A reconciliation or workflow dispatch may publish, move a latest pointer, deploy, or reset data; approve those transitive effects too.

Generic “ship it,” “ready for release,” access to credentials, or a prior release's approval is insufficient when the exact binding is missing. Reconfirm if the source/artifact/target changes. Apply the common database/OPFS/ejection stops independently; never automate a product/data decision under release approval.

## 4. Preserve protected execution

Use current supported hosted preparation, qualification, release, and recovery paths; read their scripts/workflows rather than copying stale commands or versions. Preserve protected environments, immutable tags/releases, signing/attestation/provenance, expected-head checks, and provider controls. Checked-in desired state or historical provider evidence is not proof that hosted controls are active now.

Coordinate authorized qualification sequentially through [verify mode](./verify.md). If a protected gate, artifact verification, public dependency, or provider prerequisite is missing/failing, stop and report it. Never use direct emergency npm or Maven Central publication, local credential publishing, bypass permissions, unsigned artifacts, or manual tag replacement as fallback. Local preparation or a local test pass cannot replace required hosted qualification.

**Outcome:** by default an inspection/plan with missing gates and approvals. After exact approval, only the authorized action with its actual hosted/artifact/target evidence; a successful dispatch alone does not prove publication or deployment succeeded.

**Stop:** missing owner guidance, unbound approvals, artifact/target drift, or failed protected prerequisites leaves the dependent action blocked. Report the next authorized recovery or manual decision, not an alternative publication route.

**Receipt:** use the [standard finish receipt](./workflow.md#finish-receipt). Include guidance sources read/missing, exact release/artifact/target, approval boundaries used, hosted runs and observed conclusions, remaining manual gates, and recovery risks.