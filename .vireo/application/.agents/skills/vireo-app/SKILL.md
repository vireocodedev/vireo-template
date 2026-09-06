---
name: vireo-app
description: "Use for Vireo consumer workflow routing: plan, feature, fix, review, docs, verify, generate, upgrade, and operate; not framework or Template maintenance."
---

# Vireo App

## Start

1. Before any action, read [the common workflow](references/workflow.md) and
   complete its discovery and authorization steps. Resolve skill links relative
   to this file, not the shell's working directory.
2. Select one mode from the table below. Accept `$vireo-app <mode> <request>` or
   infer the mode from plain language. Preserve explicit constraints such as
   plan-only or no tests across every handoff. If intent is ambiguous, start with
   read-only discovery; ask only for the missing decision that changes scope or
   effects. Do not infer deployment permission from "finish" or "make ready".
3. State the selected mode, application root, intended outcome, and permitted
   effects. Then **read the selected SKILL.md in full and execute its steps** for
   specialist routes. A link, skill name, or mention is not an automatic load.
   For local modes, execute the corresponding procedure below.
4. Stop at the requested outcome or a permission/ownership blocker and return the
   common completion receipt. A handoff never expands authorization. If switching
   modes, explain why and read the next skill before acting.

## Modes

| Mode       | Outcome                                                                   | Procedure to read and execute                                                                   |
| ---------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `plan`     | Scope, options, vertical slices, checks, and approvals; no implementation | Plan below                                                                                      |
| `feature`  | A bounded application behavior                                            | [Feature author](../vireo-app-feature-author/SKILL.md), feature path                            |
| `fix`      | Reproduced defect and regression-protected correction                     | [Feature author](../vireo-app-feature-author/SKILL.md), fix path                                |
| `review`   | Evidence-based findings against scope/spec; no fixes                      | Review below                                                                                    |
| `docs`     | Requested application documentation grounded in current behavior          | Docs below                                                                                      |
| `verify`   | Focused check results, or a readiness assessment if requested             | Verify below; readiness uses [production readiness](../vireo-app-production-readiness/SKILL.md) |
| `generate` | Supported capability with reviewed ownership and dry-run                  | [Generate](../vireo-app-generate/SKILL.md)                                                      |
| `upgrade`  | Supported pinned-target plan and, when authorized, application upgrade    | [Upgrader](../vireo-app-upgrader/SKILL.md)                                                      |
| `operate`  | Readiness/operational plan by default; gated execution                    | [Operate](../vireo-app-operate/SKILL.md)                                                        |

## Plan

Read-only by default. Establish the requested behavior and non-goals, observed
implementation, application-owned/managed boundaries, viable options and a
recommendation. Order work into vertical slices with observable acceptance tests,
focused checks, risk, manual owners, and approval points. For generation, upgrade,
or operations planning, read the corresponding specialist and carry **plan-only**
into it. Finish with a plan in the response; write an artifact only when requested.

## Review

Establish the diff base or explicitly named files and the originating requirement.
Inspect source, tests, and applicable repository instructions without edits,
formatting, generation, or test/build runs by default. Treat supplied test output
as attributed evidence, not a check executed in this session. Report concrete
findings with severity, file location, affected behavior, evidence, and suggested
remedy; separate assumptions and missing evidence. Include a no-findings statement
when warranted, not a readiness guarantee. Fixes require a new authorized scope.

## Docs

Identify the audience and exact behavior to document. Trace it to current code,
configuration, and observed checks; distinguish intended behavior from shipped
behavior. Edit only requested application docs and any directly necessary local
cross-references. Look up command names and versions rather than copying a stale
inventory. Check links and examples without executing effectful examples. Stop if
the documentation requires a product decision or implementation change.

## Verify

Choose the smallest relevant check from the discovered scripts and test runner
options; inspect its prerequisites and side effects before running. Report actual
output, exit status, environment, and uncovered risks. A failing check is a finding,
not permission to fix code, regenerate files, install dependencies, or launch a full
suite. For production-readiness requests, first read and execute the production
readiness skill. Coordinate any broad verification separately.

## Help and evaluation

For invocation examples, read [the usage guide](references/usage.md). When evaluating
skill behavior, read [the scenarios](references/evaluation-scenarios.md). These
skills work with ordinary file and terminal access; no personal skill, connected
service, particular tool name, or subagent is required. Instructions guide behavior;
they do not enforce permissions or guarantee autonomous completion.
