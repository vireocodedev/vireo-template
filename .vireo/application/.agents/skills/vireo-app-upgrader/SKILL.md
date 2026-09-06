---
name: vireo-app-upgrader
description: "Use for Vireo consumer upgrade planning and approved supported-edge changes to CLI, packages, and Template provenance; not framework release execution."
---

# Vireo App Upgrader

Before any action, read [the common workflow](../vireo-app/references/workflow.md)
and complete its discovery and authorization steps. Default to inventory and a
non-writing plan. An upgrade request does not acknowledge application-owned work or
authorize destructive recovery, arbitrary Git changes, or deployment.

## 1. Establish source and exact target

- Inventory recorded creation/upgrade provenance, Template commit, profile, current
	package coordinates and lockfiles, generated capability state, managed-file drift,
	ejected files, migrations, and app-specific verification. Discover any status
	command from the available CLI; use it only after confirming its non-writing
	behavior and prerequisites.
- Resolve a requested target to an **exact CLI version and matching declared edge**
	from that target CLI's shipped policy and version-matched release documentation.
	If the target is unspecified, determine documented candidates without applying
	one; ask for the target decision if needed. Never apply using `latest`, a guessed
	release number, an unverified global executable, or merely the source project's
	older CLI. Missing tools or downloads follow the common provisioning gate.
- Verify that the actual source version/Template commit and profile are accepted by
	the target edge. Distinguish executable support from historical, superseded,
	terminal, EOL, or planned release records. A package version or changelog alone
	does not prove a supported project migration.
- Missing/legacy provenance, unknown commits, drift, or an absent edge must produce
	an explicit unsupported/blocked result. Offer a manual migration plan with known
	source/target evidence, application-owned changes, tests, and unresolved choices.
	Never synthesize metadata, relabel the source version, alter hashes, or force an
	upgrade so it appears supported. Do not chain inferred hops.

Done when the source, pinned target CLI, declared edge and support verdict are
evidenced, or an honest manual plan identifies why automated apply must stop.

## 2. Review a non-writing plan

Use the pinned target CLI's discovered dry-run for the declared edge. Inspect its
actual output and relevant source-to-target changes; separate:

1. Declared managed edits and refused/customized paths.
2. Application-owned source, root guidance, tests, configuration, deployment, and
	 migrations requiring a product decision or manual port.
3. Generated-once and ejected capabilities that must stay preserved.
4. Dependency/lockfile work **only if required by this edge or accepted app work**.
5. Focused validation, later coordinated checks, code/schema compatibility, and
	 backup/recovery needs for any persistent-data effects.

Plan-only stops here. Before apply, obtain acceptance of the specific plan and
explicit acknowledgment of outstanding application-owned work. An acknowledgment
flag records responsibility, not completion. Recheck target-file drift against the
baseline; if a clean-tree prerequisite cannot be met, ask the owner to prepare it
rather than stashing, reverting, committing, or overwriting their work.

## 3. Apply only the accepted changes

Run only the accepted managed edge with the pinned target CLI and reviewed flags.
Keep unrelated files, application-owned source, and ejected capabilities intact.
Review the resulting diff and status; interrupted or refused transactions require
the documented recovery plan, not manual provenance surgery or a forced retry.

Port only the application-owned changes the user separately included in scope.
For such implementation, read [Feature author](../vireo-app-feature-author/SKILL.md)
and execute its vertical slices. Refresh the real lockfile with the project's
package manager only when required and authorized; do not invent resolved entries
or update unrelated dependency versions. Preserve migration history.

## 4. Verify and close

Verify the managed result and chosen application changes with focused checks first;
coordinate broad verification before running it. Reconcile every accepted plan item
as completed, unverified, manual/pending, or blocked. Define recovery against both
artifact and data: an older binary cannot be assumed safe after newer writes or
schema changes. Actual environment recovery belongs to explicitly authorized
[Operate](../vireo-app-operate/SKILL.md), which must be read before execution.

Return the common receipt with source/target/edge, actual dry-run/apply/check output,
managed versus application-owned status, unchanged surfaces, and remaining approvals.
A successful CLI transaction proves neither feature parity nor production readiness.
