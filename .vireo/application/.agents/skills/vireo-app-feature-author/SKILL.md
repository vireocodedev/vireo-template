---
name: vireo-app-feature-author
description: "Use for Vireo consumer features and reproducible fixes across UI, adapters, APIs, and persistence; not framework or Template maintenance."
---

# Vireo App Feature Author

Before any action, read [the common workflow](../vireo-app/references/workflow.md)
and complete its discovery and authorization steps. It governs every step below,
including direct invocation without the router. Carry the requested `feature`,
`fix`, or `plan-only` mode through the work.

## 1. Identify the behavior and boundary

- **Feature:** translate the request into observable acceptance behavior and
	non-goals. Trace the existing public route/component, application adapter, API,
	and persistence boundaries only as far as this profile and feature require.
- **Fix:** capture expected versus actual behavior, a minimal reproduction, and
	relevant sanitized output. Form a testable cause, examine the affected boundary,
	and reproduce the failure before changing implementation. Missing evidence is a
	blocker or stated hypothesis, not a reason for broad speculative fixes.
- Use the local conventions for public imports, forms, validation, accessible
	names, keyboard behavior, loading/empty/error states, localization, and product
	identity. Keep authorization and owner/tenant decisions in application-owned
	policy; frontend presentation is not a server authorization boundary.

Done when the acceptance behavior, test seam, affected ownership, and smallest
vertical slice are explicit. In plan-only mode, return this plan without writes or
test runs unless separately requested.

## 2. Protect and implement one slice

1. Follow the common red-green sequence at the chosen public boundary. For a fix,
	 the regression must demonstrate the original failure; record an unrelated setup
	 failure separately. Implement only enough to satisfy this slice, then repeat.
2. For an unconfigured/sentinel adapter error, trace the application bootstrap,
	 import order, registration and the selected real/mock mode through the actual
	 failing call (for example login). Test registration before use and the selected
	 adapter behavior. Preserve the sentinel's fail-fast contract; do not replace it
	 with a no-op, suppress the error, or enable mock authentication in production.
3. When persistence changes, follow append-only migration and compatibility rules.
	 For offline/owner/concurrency/conflict changes, add the focused behavioral tests
	 required by the common workflow, including authorization failures and lost-work
	 risks relevant to this slice. Data-safety work is incomplete without that coverage;
	 unrun tests remain unverified if execution is prohibited.
4. If supported generation would help, first read and execute
	 [Generate](../vireo-app-generate/SKILL.md) within this scope. Review its dry-run
	 and ownership before writing. An unsupported schema needs a scoped manual design,
	 not an implicit ejection or weakened schema.

Done when each implemented behavior has its regression/acceptance coverage and the
source diff stays inside the agreed slice. Stop if the fix belongs in upstream
packages, requires new product rules, or collides with unrelated/concurrent edits.

## 3. Verify and hand back

Run the smallest relevant checks discovered in this application, then any necessary
affected contract/type/area checks within the agreed budget. Include a focused user
flow when bootstrap, routing, or adapter wiring cannot be established by a unit
test alone; use a disposable local target, never real user data. Do not mistake mock
mode success for real-backend evidence. Coordinate broader verification separately.

Inspect the final diff against the baseline and return the common receipt with
acceptance behaviors, actual red/green output or explicit unrun gaps, ownership,
migrations/manual work, and residual risk. Tests passing is not deployment approval.
