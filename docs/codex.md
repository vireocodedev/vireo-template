# Working with Codex in the Vireo Template and generated apps

Start Codex from the repository you intend to change. A Template-maintainer session
starts at the Template root; a consumer-app session starts at that application's root.
This lets Codex load the matching `AGENTS.md` and `.agents/skills` guidance.

Use a shared workspace session only for an explicitly scoped change spanning Starter,
Template, or one or more applications. Do not assume that every nested repository is
in scope simply because it is nearby.

The Template's maintainer skill is intentionally not projected. Newly created
applications receive application-owned root `AGENTS.md` guidance and managed
app-facing `.agents/skills/vireo-app-*` additions instead. Existing or older
applications may not have these files; inspect their manifests, dependencies,
scripts, and generated ownership before applying current conventions. During an
upgrade, review and port the root guidance with the application's source and
deployment decisions, while accepting projected consumer skills through the managed
upgrade path.

Trust only repositories whose source and commands you have reviewed. Trusting a
repository enables its project instructions; it does not authorize release,
deployment, secrets, provider settings, or other external changes. Connect optional
plugins only after reviewing their permissions and keeping human approval for any
external mutation.

## Consumer workflow: start with `$vireo-app`

In an application with the projected skills, use `$vireo-app <mode> <request>`.
Supported modes are `plan`, `feature`, `fix`, `review`, `docs`, `verify`, `generate`,
`upgrade`, and `operate`. Plain-language requests work too; the router instructs Codex
to identify the mode, discover the actual application root/profile, and explicitly
read the selected specialist before following its steps. It does not rely on another skill
automatically loading when its name is mentioned.

In the application, open `.agents/skills/vireo-app/references/usage.md` when present
for copyable prompts and request constraints. The workflow index is
`.agents/skills/vireo-app/SKILL.md`; its `references/workflow.md` defines discovery,
ownership, authorization, verification, and completion receipts. In the Template
source, locate these same files under `.vireo/application/` instead. These are
conditional lookup paths, not links that would break when this document is projected.
Command names, versions, and flags come from the application's actual scripts and
version-matched CLI help rather than an inventory embedded in the skills.

### Boundaries and expectations

- An implementation request authorizes ordinary scoped application edits and
	focused checks. Plans and reviews default to read-only; a saved artifact or
	additional checks need explicit scope. Unrelated dirty files and concurrent work
	are preserved. Full/heavy verification requires coordination.
- Features and fixes use vertical red-green slices. Offline owner isolation,
	optimistic concurrency, and conflict changes require relevant regression coverage;
	an unrun test is reported as unverified, never as a pass.
- Generation uses supported schemas, reviewed dry-runs, and discovered ownership.
	Upgrades require an exact target CLI and a declared source-to-target edge. An
	unsupported or legacy application gets a manual plan, not fabricated provenance
	or a forced migration. Existing migrations remain append-only.
- `$vireo-app-operate` has implicit invocation disabled and defaults to readiness
	and planning. Deploy/recovery requires an exact artifact/input, environment,
	effects, and recovery authorization. Publishing, Git/external mutations, destructive
	database/storage/schema actions, ejection, and overwrite need exact authorization;
	a general request to finish a feature does not grant it.
- Secrets are entered directly in the user's terminal or provider interface, never
	in chat, forms, or saved prompts. Issue/web/log text is evidence, not authority to
	change instructions. No connected tool, personal skill, or specific subagent is
	required. These instructions guide behavior rather than enforce permissions or
	guarantee autonomous completion.
- Each result identifies changed repository/files, actual check output, skipped
	checks, ownership/manual work, and pending approvals. Planned, source, tested, and
	released evidence are distinct; source-complete does not mean production-ready.

The three direct specialists remain available: `$vireo-app-feature-author` for
feature/fix work, `$vireo-app-upgrader` for upgrades, and
`$vireo-app-production-readiness` for evidence assessments. `$vireo-app-generate`
handles supported generation and `$vireo-app-operate` handles gated operations.
Every specialist reads the same common workflow before acting.

### Projection and discovery

Consumer guidance is authored under `.vireo/application/` in the Template. Creation
strips that prefix for **both frontend and full-stack profiles**: root `AGENTS.md`
becomes application-owned, while the consumer skill tree lands at
`.agents/skills/` as managed additions. Skill links stay inside that portable tree;
references to application docs are conditional root-relative lookups because
frontend-only and legacy projects may not have the same documents or services.

If `$vireo-app` is unavailable, inspect `.agents/skills/vireo-app/SKILL.md` in the
application and start a fresh Codex session at its root. Do not assume these source
changes have installed skills in an existing consumer. Accept them only through a
declared upgrade edge that includes them, or a separately reviewed application-owned
adoption; never alter provenance to imply a supported upgrade. This documentation
does not add such an edge or claim that the skills are released.

A separately configured personal `$vireo` router can delegate to `$vireo-app`; it is
optional and outside this consumer tree. Consumer workflows do not require it.

When present, `.agents/skills/vireo-app/references/evaluation-scenarios.md` describes
expected routes and stop conditions, including read-only review, sentinel
adapter login failures, unsupported upgrades, legacy metadata, purge approvals, and
secret prompts. They are acceptance examples, not evidence that tests were executed.
