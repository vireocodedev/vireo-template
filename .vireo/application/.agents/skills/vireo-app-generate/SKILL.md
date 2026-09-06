---
name: vireo-app-generate
description: "Use for Vireo consumer capability generation, regeneration checks, and explicitly requested ownership transitions; not unsupported schema coercion or framework generator development."
---

# Vireo App Generate

Before any action, read [the common workflow](../vireo-app/references/workflow.md)
and complete its discovery and authorization steps. Keep plan-only constraints
throughout. Generation is not permission to overwrite application work or change
ownership.

## 1. Establish capability and ownership

Inspect the project's pinned CLI entry point, available executable/version, profile,
schemas, and generated capability manifests/contracts/indexes. Read relevant local
generation documentation if present, then the actual CLI's schema/support contract
and help. Do not copy a command/version from this skill or assume full-stack entity
generation exists in a frontend-only or legacy application.

Identify the requested schema/capability and its product requirements. Validate the
shape against the discovered schema version and supported features. If relationships,
compound IDs, offline behavior, or any other requested shape is unsupported by that
CLI, stop with the rejection and offer a manual application-owned design. Do not
silently simplify requirements or advertise partial generation as support.

Classify prospective files as managed mechanical output, generated-once/application-
owned, optional, or ejected. Compare current contents to recorded provenance before
proposing regeneration. Unknown or customized ownership is a stop condition, not a
reason to fabricate hashes.

## 2. Review the dry-run

Use the project's discovered, pinned generator dry-run only after inspecting its
prerequisites and confirming it does not write project files. If unavailable, explain
the limitation and stop before generation; do not install or invoke another release
silently. In strict read-only mode, inspect files instead if even the launcher would
download tools or mutate caches.

Summarize actual proposed paths, ownership, collisions, schema/migration effects,
and registration changes. Confirm they fit the requested outcome and the dirty-file
baseline. A plan-only request stops with this summary. For an implementation request,
a supported additive plan within scope may proceed without approval for every file.
Broader effects and ownership transitions require the common exact-authorization gate.

## 3. Generate or perform an approved transition

Execute only the reviewed generation plan and inspect the diff immediately afterward.
Preserve domain customizations in generated-once source, append-only migrations,
and ejected capabilities. Keep managed manifests, contracts, and indexes under their
declared generator rather than hand-editing them to hide drift. Do not execute an
emitted migration against an environment as part of ordinary generation.

For a specifically requested ejection, removal, or overwrite, first explain the exact
capability, paths, registration/contract-check consequences, potential loss, and
recovery plan; show the available dry-run and obtain exact authorization. Never use
an ownership transition as an automatic escape from a refusal. Ejection may stop
management without deleting code; establish the actual CLI semantics, not assumptions.

## 4. Verify the resulting boundary

Discover and run the focused generated contract/consistency check and relevant tests
within budget. Use actual profile-specific checks: inspect route/index registration,
frontend behavior, and API/persistence coverage only where generated. If business
behavior still needs implementation, read and execute
[Feature author](../vireo-app-feature-author/SKILL.md) for that scoped work and its
vertical-slice tests. Generated source alone is not tested feature completion.

Return the common receipt with CLI/schema provenance, actual dry-run/generation/check
output, generated file ownership, application-owned follow-up, and skipped checks.
Stop rather than expand into upstream generator changes or unsupported behavior.