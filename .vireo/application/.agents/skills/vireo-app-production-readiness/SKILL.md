---
name: vireo-app-production-readiness
description: "Use for evidence-based production-readiness assessments of Vireo consumer applications; not deployment execution or a substitute for narrow feature tests."
---

# Vireo App Production Readiness

Before any action, read [the common workflow](../vireo-app/references/workflow.md)
and complete its discovery and authorization steps. This is an assessment, read-only
by default. Run checks only when requested and within the coordinated budget; an
assessment alone does not authorize repairs, infrastructure changes, or deployment.

## 1. Bind the assessment

Identify the application profile, source revision/dirty state, candidate artifact if
known, target environment, deployment shape, persistence, identity model, and
operational owner. Record unknowns. Locate actual runbooks/configuration using the
common conditional lookups; do not assume a frontend-only app owns a JVM service or
that a local Compose result describes the destination environment.

Done when the assessed target and evidence boundaries are explicit. If an artifact
or environment is not yet chosen, provide a gap assessment rather than a go-live
verdict.

## 2. Build an evidence matrix

For each applicable area, record source location, observed evidence with date and
revision/artifact/environment, gap/risk, and responsible owner. Mark not-applicable
with a reason instead of silently skipping an area.

| Area                       | Evidence to seek                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application behavior       | Relevant acceptance/regression results, real/mock adapter separation, bootstrap/login and authorization boundaries, accessibility and critical flows                  |
| Persistence and offline    | Append-only migration compatibility, owner isolation, optimistic concurrency/conflict tests, queue/replay behavior, backup and restore rehearsal evidence             |
| Configuration and artifact | Runtime profile, production-safe settings, known artifact identity, dependency/security assessment output and unresolved findings                                     |
| Delivery boundary          | Actual ingress/TLS/header policy, health/readiness and failure behavior, authenticated cache exclusions, PWA update behavior and stream/proxy configuration when used |
| Operational ownership      | Monitoring/alerts, incident contacts, runbook, capacity assumptions, rollback conditions and data-loss limits                                                         |
| Human/provider decisions   | Secret provisioning, access control, product identity, domain/tenant authorization, data classification/retention, privacy/legal requirements and go-live approval    |

Inspect relevant tests as source evidence. For sensitive offline/owner/concurrency/
conflict changes, require the regression coverage described in the common workflow;
missing or unrun coverage is a readiness gap, not satisfied by lint or compilation.

Done when each applicable risk has supporting evidence or a named gap. Supplied
reports remain attributed; stale or mismatched reports do not certify today's diff.

## 3. Run only scoped checks

If execution is requested, select the narrow checks that address the current gaps,
inspect their scripts and environment effects, and record actual output. Coordinate
heavy suites, browser/service startup, and integration environments first. Treat
missing credentials via secure terminal/provider entry, not prompts. Missing tools
or connected services result in a blocked/manual check, not bypassed safeguards.

## 4. Return a bounded readiness result

Separate repository-controlled changes from application-team/provider/manual work.
Use **blocked**, **evidence incomplete**, or **ready for human approval of the named
target**, with the evidence and scope behind the verdict. Never approve production
on behalf of an owner or equate a local pass with release/deployment evidence.

Return a dated matrix and the common receipt in the response. Write an evidence file
only at a user-requested destination. Remediation needs its own scoped feature/fix
request. Actual deployment or recovery requires an explicit operations request:
read [Operate](../vireo-app-operate/SKILL.md) and apply its authorization gate before
any environment mutation.
