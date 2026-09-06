---
name: vireo-template
description: "Use for Vireo Template maintainer plan, change/feature, fix, review, docs, verify, and release/operate work; not framework implementation or generated-application product work."
---

# Vireo Template

Template-local lifecycle router. Accept direct `$vireo-template <mode> <task>` requests or a handoff from the user's universal `$vireo` router. Do not create a second universal router or assume a user-level skill is installed.

## Route in order

1. **Identify.** Confirm this is Template source using repository instructions, [Template metadata](../../../.vireo/template.json), and [release policy](../../../contracts/template-release-policy.json), not the directory name alone. A generated-app provenance marker or contradictory identity needs clarification before writes. Framework implementation and generated-app product work return to the parent router with evidence and an owner handoff.
2. **Preflight.** Read the [common workflow](./references/workflow.md) once per task. Capture the requested outcome, allowed paths, mode, profiles, baseline, and execution restrictions before selecting actions.
3. **Select.** Load only the relevant mode reference below. An explicit request to implement or fix selects that mode; an ambiguous request starts with a non-writing plan. Mixed requests are ordered phases with separate outcomes; review never silently becomes change, and release/operate starts with inspection even when named explicitly.

   | Mode                 | Load when                                                        | Procedure                                            |
   | -------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- |
   | `plan`               | Design, scope, impact analysis, or uncertain intent              | [Plan](./references/plan.md)                         |
   | `change`, `feature`  | Implement accepted Template behavior                             | [Change / feature](./references/change.md)           |
   | `fix`                | Diagnose or repair a reported defect/regression                  | [Fix](./references/fix.md)                           |
   | `review`             | Inspect a diff against standards and requested behavior          | [Review](./references/review.md)                     |
   | `docs`               | Update current guidance or explain historical/published behavior | [Docs](./references/docs.md)                         |
   | `verify`             | Plan or execute authorized checks and report evidence            | [Verify](./references/verify.md)                     |
   | `release`, `operate` | Release preparation, recovery, deployment, provider inspection   | [Release / operate](./references/release-operate.md) |

4. **Specialize.** For source, profile, generated assets, or projection-impact work, also read [$vireo-template-maintainer](../vireo-template-maintainer/SKILL.md). It shares the common workflow; loading it grants no extra paths, tools, or execution authority. Read nearest scoped repository instructions for every affected area.
5. **Finish.** Execute only the authorized phase and return the [standard receipt](./references/workflow.md#finish-receipt), including blocked or inspection-only outcomes. For harness maintenance or routing review, use the [scenario evaluations](./references/evaluations.md); these are evaluation cases, not a claim that anything ran.
