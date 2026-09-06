# Docs mode

**Input:** audience, desired guidance, source/release scope, and authorized documentation paths. Apply the [common workflow](./workflow.md).

1. Classify audience and time: maintainer versus generated-app reader; **current working-tree guidance** versus **immutable published/historical instructions**. Identify the authoritative source/release for each claim before editing.
2. For current guidance, inspect live manifests, scripts, contracts, and implementations. Describe unpublished source behavior as unpublished; inspect exact public artifacts before claiming availability. Link to the canonical version source instead of copying a version into generic workflow prose.
3. Preserve immutable published pins and historical upgrade edges. An old command may intentionally target a release; do not replace it with the latest CLI or rewrite a historical failure/superseded release as supported. Add a separately labeled current correction when authorized, rather than changing historical evidence. Pin-specific documentation changes require release intent and the approved release/artifact context.
4. Classify each documentation path for both profiles. Keep maintainer operations/evidence out of application guidance. Explain generated-once adoption versus managed updates without promising that acknowledging application-owned work applies it. Follow [domain documentation conventions](../../../../docs/agents/domain.md) for domain terms/ADRs and preserve existing published records.
5. Check links relative to each file, command existence/side effects by reading scripts, and consistency with [generated capabilities](../../../../docs/generated-capabilities.md), [project upgrades](../../../../docs/project-upgrades.md), and [release preparation](../../../../docs/template-release-preparation.md). Never execute a documentation example automatically. Read-only link/structure inspection is distinct from tests and does not validate runtime behavior.

**Outcome:** audience-correct documentation with source/public/tested claims and temporal scope clearly separated. No package version bump or Template pin movement is implied by a prose update.

**Stop:** unknown publication state, ambiguous ownership, or an immutable record that cannot be verified becomes a documented gap. Do not guess a public version or expand file scope to “synchronize” another owner's docs.

**Receipt:** use the [standard finish receipt](./workflow.md#finish-receipt); list exact files, static inspections, and unavailable public or runtime evidence.