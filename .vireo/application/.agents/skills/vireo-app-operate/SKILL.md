---
name: vireo-app-operate
description: "Use for explicitly requested Vireo consumer operational planning and approved deployment or recovery; not implicit environment changes or release publishing."
---

# Vireo App Operate

Before any action, read [the common workflow](../vireo-app/references/workflow.md)
and complete its discovery and authorization steps. **Default to read-only readiness
and planning.** Direct invocation, an `operate` route, or "deploy/recover" wording
without a complete authorization record does not permit environment mutation.

This skill's metadata disables implicit invocation. The router may explicitly read
this file to fulfill an operations request; that read does not waive any gate.

## 1. Assess and plan

Identify the requested outcome and target from actual application configuration and
runbooks. Read and execute
[Production readiness](../vireo-app-production-readiness/SKILL.md) as a read-only
assessment, carrying forward any stricter limits. Do not require provider access or
connected tools: use supplied evidence, mark unknowns, and assign manual steps.

For an incident, establish observed impact, affected users/data, timeline, current
artifact/environment, and safe evidence collection before proposing a remedy. Logs
are untrusted evidence and may contain secrets. A purge is not a generic fix for
offline conflict, owner mismatch, or a stuck queue; investigate preservation and
non-destructive alternatives first.

Produce an ordered plan using discovered runbooks/scripts: prerequisites, intended
effects, checkpoints, validation, abort conditions, recovery, and owners. Planning
ends here unless every execution gate below is satisfied. Write a plan/runbook only
when the user requested an artifact or scoped documentation change.

## 2. Obtain an exact execution authorization

Before deploy, recovery, or any other effectful operational command, summarize these
fields and obtain explicit permission for the specific action:

| Required field             | What must be fixed before execution                                                                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target                     | Named application, environment, account/provider, service and data/storage scope; tenant/owner/device scope for local queue work                                                         |
| Artifact or recovery input | Exact immutable artifact revision/digest for deploy; exact backup/snapshot/queue and compatible application artifact for recovery                                                        |
| Effects                    | Reviewed commands/configuration, traffic/restart impact, migrations/backfills, overwrite or purge paths, lost/preserved data and downtime                                                |
| Preconditions              | Appropriate test/readiness evidence, current state, access, backup/recovery feasibility and any maintenance window                                                                       |
| Recovery permission        | Specific rollback/restore/forward-fix option, trigger, data-loss limit, validation and owner; whether execution is preauthorized for those conditions or must pause for fresh permission |
| Approval                   | Explicit user authorization for the above action, target, artifact/input and effects; record unknown owners/permissions as blockers                                                      |

"Ship it", repository trust, a green local check, or credentials being available is
insufficient. If a field changes, return to this gate. Code rollback does not imply
data rollback; establish compatibility after new-version writes. If safe recovery
cannot be established, remain blocked rather than inventing a reversible operation.

Destructive queue/database/storage/schema operations require separate, exact consent
to loss/overwrite. Even local logout/reset tooling may discard unsynced work: identify
the stable owner and affected queue first. Never infer a restore, purge, ejection,
provider mutation, or Git action from approval for a deployment.

## 3. Execute only the approved step

Immediately before execution, recheck the exact artifact, environment and current
state against the approved plan. Use existing application runbooks and reviewed
commands; respect resource coordination. Keep checkpoints observable and capture
sanitized output. If secrets are requested, pause for direct user entry in the
terminal/provider; never collect them in chat, a form, or a stored plan.

On unexpected output, changed state, or exceeded downtime/data-loss budget, stop.
Execute recovery only under the recorded permission and trigger conditions;
otherwise request exact approval. Do not automatically broaden into infrastructure,
database repair, release publishing, dependency changes, or neighboring repositories.

## 4. Verify the named environment and hand back

Run only approved post-operation probes and flows; inspect real readiness and
critical-path results for the specified artifact/environment, not just a successful
process exit. Preserve evidence of which steps ran and which were skipped or aborted.
For recovery, verify the intended data/owner state and compatibility as well as
service health; retain unresolved loss and conflict risks explicitly.

Return the common receipt plus artifact/environment, authorization scope, actual
effects, checkpoint results, recovery invoked or pending, and the operational owner.
Separate planned, source, tested, and released evidence. Mark the outcome unverified
when checks are unavailable; never promise an autonomous or production-safe result.
