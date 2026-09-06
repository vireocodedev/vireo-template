# Review mode

**Input:** base and head (or working-tree scope), originating issue/spec, review criteria, and authorized inspection boundary. Apply the [common workflow](./workflow.md).

1. Establish the exact diff and baseline. If the comparison point or requirement is missing, ask or state a bounded assumption; do not invent the intended spec.
2. Read applicable repository standards and the original requested behavior. Inspect affected implementations, callers, contracts, tests, and both-profile projection ownership. Consult the [maintainer specialist](../../vireo-template-maintainer/SKILL.md) for projection impact.
3. Review **standards** and **spec/behavior** separately. Apply relevant [risk coverage](./change.md#regression-coverage-by-affected-boundary), version/pin boundaries, source-versus-published claims, and new/existing-consumer adoption. Distinguish an executable upgrade edge from application-owned instructions.
4. Report actionable findings with severity, exact location, violated requirement/invariant, evidence, expected impact, and a proposed next step. Mark unverified findings and assumptions explicitly; reserve “reproduced” for actual evidence. If nothing actionable is found, say so with coverage limits rather than implying exhaustive correctness.
5. Return recommendations without applying them. Review is read-only: no edits, formatting, generated artifacts, installs, tests/builds, mode switches, commits, or provider mutations. Read existing evidence; hand requested execution to a separately authorized verify phase rather than expanding this one.

**Outcome:** findings grouped by standards and spec/behavior, followed by unanswered questions and verification gaps.

**Stop:** do not fix a finding, change baselines, resolve conflicts, or approve data loss during review. Missing evidence limits the conclusion; it is not permission to manufacture a pass.

**Receipt:** use the [standard finish receipt](./workflow.md#finish-receipt); files changed is none and unexecuted checks remain skipped.