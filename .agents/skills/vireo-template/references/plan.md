# Plan mode

**Input:** desired behavior or question, allowed repositories/paths, constraints, and acceptance criteria. Apply the [common workflow](./workflow.md).

1. Inspect the owning source, relevant contracts, nearest instructions, and current scripts without edits or command side effects. Distinguish a requested feature, reproducible defect, and unverified finding.
2. Build the path/profile matrix and trace framework → Template → projection → app impact. If authoritative classification is unavailable, keep affected work proposed and blocked rather than guessing coverage.
3. Propose the smallest vertical change, sequencing upstream handoffs before dependent Template work. Separate new-app projection from managed upgrades and application-owned adoption. Use published dependencies as the baseline.
4. Define observable acceptance criteria and focused regression checks. Include [change-mode risk coverage](./change.md) where relevant. Plan both-profile fixtures, full suites, hosted gates, and manual evidence separately using [verify mode](./verify.md); do not run them in this phase.
5. Name decision points: incompatible contracts, release pins, ejection, destructive data work, and external operations. Estimate uncertainty from missing evidence rather than claiming implementation readiness.

**Outcome:** an ordered, reviewable plan with scoped files, ownership, acceptance criteria, verification choices, dependencies, and approval stops. Return it in the response unless writing a plan artifact was explicitly requested and its path is authorized/classified.

**Stop:** ask only for decisions that block a safe plan; no implementation, installs, tests, version changes, or provider actions follow merely from producing one.

**Receipt:** use the [standard finish receipt](./workflow.md#finish-receipt); identify unresolved assumptions and all execution as skipped.