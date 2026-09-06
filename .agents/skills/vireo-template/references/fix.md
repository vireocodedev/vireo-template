# Fix mode

**Input:** reported symptom, expected behavior, reproduction/context, affected revision/profile/dependency mode, and execution restrictions. Apply the [common workflow](./workflow.md) and [maintainer specialist](../../vireo-template-maintainer/SKILL.md).

1. Inspect the relevant path and nearest tests. Separate observed facts from hypotheses; distinguish product failure from environment, unavailable published artifacts, configuration drift, or another worker's changes. Preserve logs with secrets removed.
2. When permitted, reproduce with the smallest non-destructive case in the recorded dependency mode. A **reproduced defect** has an observed mismatch and failing evidence; an **unverified finding** is a code suspicion or report without that reproduction. Do not silently relabel one as the other.
3. For a reproduced defect, add the smallest regression test and observe red for the same reason, fix the cause, observe green, then refactor with the focused test still green. For no-test tasks or unavailable environments, record the intended regression test and missing evidence; source repair may proceed only within the accepted scope and remains unverified.
4. Check adjacent boundaries with the [change-mode regression matrix](./change.md#regression-coverage-by-affected-boundary), especially auth/CSRF/service policy and offline owner/lock/replay/conflict behavior. Preserve pending offline work for diagnosis; no automatic database reset, OPFS purge, managed overwrite, or ejection.
5. Verify the smallest relevant path first through [verify mode](./verify.md), then coordinate any broader evidence. Report the original reproduction result separately from post-change checks. Restore any authorized temporary dependency mode as specified in the common workflow.

**Outcome:** a reproduced-and-verified repair, an explicitly unverified scoped repair, or a diagnosis with a blocked next step. Name the cause only to the strength of the evidence.

**Stop:** no speculative framework fork, version bump, policy weakening, or public-to-local switch as a workaround. Missing reproduction does not justify destructive cleanup or an unlimited rewrite.

**Receipt:** use the [standard finish receipt](./workflow.md#finish-receipt), including symptom, reproduction status, causal evidence, and regression results actually observed.