# Loading-State and Skeleton Audit

**Phase:** 8 — enforcement

**Status:** Loading-state standard implemented and enforced

**Audited against:** [Vireo Loading-State and Skeleton Standard](LOADING_STATES.md)

**Scope:** Starter Template route boundaries, page compositions, queries, mutations, and loading verification

## Purpose

This document is the Phase 2 compliance baseline for the Starter Template frontend. It records every current loading owner, separates route-code loading from data and action loading, assigns geometry expectations, and establishes the application remediation queue.

The original audit deliberately separated waiting-state behavior from eager-versus-lazy decisions. The post-Phase 8 strategy follow-up now records that decision while preserving the loading contracts for every route that remains lazy.

## Rating and priority

| Rating         | Meaning                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Aligned        | The audited behavior follows the applicable standard. Broader verification may still be open.                                          |
| Partial        | The treatment is directionally correct, but ownership, timing, geometry, accessibility, state handling, or verification is incomplete. |
| Non-compliant  | The implementation contradicts a `MUST` or `MUST NOT` requirement.                                                                     |
| Not applicable | The route or component has no independent asynchronous visual state beyond route-code loading.                                         |

| Priority | Meaning                                                                |
| -------- | ---------------------------------------------------------------------- |
| P0       | Application-wide policy or a highly visible reference workflow.        |
| P1       | Material feature, geometry, state, or accessibility gap.               |
| P2       | Narrower consistency, error handling, documentation, or coverage work. |

## Executive baseline

The template already distinguishes initial item loading, retained refresh, incremental pagination, empty results, query errors, and busy mutations in several important paths. Overview also demonstrates the correct structural technique: loaded and loading modes share one page composition and replace only leaves.

The Phase 7 baseline is:

1. Every lazy route now declares its loading presentation policy in the route registry.
2. Unknown route structures use progress-only Level C treatment instead of an invented detailed skeleton.
3. Route, bootstrap, and Overview loading surfaces consume the shared Starter loading boundary and skeleton leaves.
4. Items now applies the shared table and loading-region contracts across initial loading, refresh, empty, initial error, and retained refresh-error states.
5. Overview now verifies exact loaded/loading geometry across English and Croatian, every page-width preference, and real compact/desktop viewports; Items and the shared responsive table retain their alignment contracts.
6. History, filter-definition, and relation-option surfaces now cover initial loading, retained refresh, empty, recoverable error, accessibility ownership, and their applicable geometry contract.
7. Item form, item deletion, and login mutations retain their real context, prevent duplicate or unsafe actions, and recover without replacing established content.
8. Cross-theme, explicit reduced-motion, layout-shift, accessibility, localization, authoring, and architecture contracts are enforced in Phase 8.

## Route-code loading inventory

Every route in `APP_PAGE_REGISTRY` declares `eager` or `lazy` rendering plus an explicit `retain`, `progress`, `skeleton`, or `none` presentation policy. Overview is eager; the remaining routes retain lazy boundaries.

| Effective route group                 | Route IDs                                                    | Current fallback                                                                                           | Geometry                       | Rating  | Priority |
| ------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------ | ------- | -------- |
| Application bootstrap and login chunk | `login`, plus authentication recovery before route selection | Branded application progress with separate labels, one shared boundary, and delayed visible feedback.      | C, progress-only               | Aligned | —        |
| Eager Overview                        | `home`                                                       | Synchronous page composition; no route-code fallback or skeleton appears.                                  | No wait                        | Aligned | —        |
| Progress-only authenticated routes    | `items`, `settings`, `forbidden`, `notFound`                 | Real shell, page layout, width preference, and localized static header with bounded progress-only content. | C; stable frame/header anchors | Aligned | —        |

The progress-only group preserves the application shell, `AppPageLayout`, the user's page-width preference, localized static header content, and known back navigation. It deliberately does not speculate about destination actions, tables, forms, cards, canvases, or vertical geometry.

### Required route-policy direction

Every registry entry declares both render strategy and loading policy. A `skeleton` policy remains valid only when a lazy route imports a shared synchronous structure also used by its loaded page; no production route currently needs that tradeoff.

Overview is eager because its exact skeleton already imported the full page structure synchronously, so the route split saved negligible code while creating a visible transition. Other routes remain lazy where feature, access, or infrequent-use boundaries still reduce entry cost. Navigation intent prefetch limits their perceived latency.

## Application surface inventory

| Surface                          | Wait type and category                       | Current treatment                                                                                                                   | Geometry target    | Rating         | Priority | Owner                      |
| -------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------ | -------------- | -------- | -------------------------- |
| `AppBootstrapFallback`           | Auth/bootstrap; `boundary`                   | Branded full-screen progress through one shared delayed loading boundary.                                                           | C                  | Aligned        | —        | App shell                  |
| Overview Item snapshot           | Initial data; `boundary`, `skeleton-capable` | Production and Storybook use the same `AppPageHomeView` loaded/loading modes as the exact Level A implementation.                   | A                  | Aligned        | —        | Overview                   |
| `AppRouteFallback` — progress    | Route code; `boundary`                       | Reuses the page frame, width preference, localized static header, and bounded progress region without invented content.             | C                  | Aligned        | —        | App shell + route registry |
| `AppPageHomeView loading`        | Reference; `skeleton-capable`                | Reuses real header, width preference, frame, card grid, typography, and localized text geometry with shared skeleton leaves.        | A                  | Aligned        | —        | Overview page              |
| Items initial query              | Initial data; `skeleton-capable`             | Keeps toolbar, reserved result-count slot, table/list frame, headings, and pagination; delegates unknown rows to the shared table.  | B; A outer anchors | Aligned        | —        | Items feature + Starter UI |
| Items background refresh         | Refresh; `content-preserving`                | Keeps usable rows and controls; one shared delayed boundary owns busy/status semantics and a decorative two-pixel progress line.    | A                  | Aligned        | —        | Items feature              |
| Items incremental mobile page    | Pagination; `content-preserving`             | Keeps loaded rows and adds local progress below them.                                                                               | B                  | Aligned        | P2       | Items feature + Starter UI |
| Items empty result               | Empty                                        | Keeps table region and renders filtered/first-item/no-data copy with contextual actions.                                            | B                  | Aligned        | P2       | Items feature              |
| Items query error                | Error/recovery                               | Renders first-load failure exclusively inside table content; refresh failure retains rows with an overlaid warning and retry.       | B                  | Aligned        | —        | Items feature              |
| Item form create/update          | Mutation; `busy-action`                      | Keeps the form and overlay, disables submit, cancel, and close while pending, and prevents duplicate submission.                    | A                  | Aligned        | —        | Item feature + Starter UI  |
| Item delete confirmation         | Mutation; `busy-action`                      | Keeps the dialog and target visible while its async confirmation runs; rejection re-enables retry and cancel.                       | A                  | Aligned        | —        | Item feature + Starter UI  |
| Item history overlay             | Initial/refresh data; `skeleton-capable`     | Reuses the real history-entry anatomy, centralizes delay/announcements, retains records on refresh, and exposes retry/empty states. | B; A outer anchors | Aligned        | —        | Item feature + Starter UI  |
| Entity-filter definition overlay | Initial/refresh data; `boundary`             | Uses one Level C reserved region initially, retains a usable form during refresh/error, and exposes local retry.                    | C initial; A frame | Aligned        | —        | Query-filter feature       |
| Relation value editor            | Widget query; `content-preserving`           | Keeps the autocomplete and selected values, distinguishes loading/empty/error, and supports retained-data retry.                    | A control frame    | Aligned        | —        | Query-filter feature       |
| Login submission                 | Mutation; `busy-action`                      | Keeps the login card and fields, prevents duplicate submission, and restores the action with local error feedback.                  | A                  | Aligned        | —        | Login page + Starter UI    |
| Offline maintenance actions      | Mutation; `busy-action`                      | Keeps Settings visible, permits one maintenance action at a time, and restores controls with local error feedback after rejection.  | A                  | Aligned        | —        | Settings page              |
| Remaining page content           | `static`                                     | No independent data-loading surface was found; only route-code loading applies.                                                     | Not applicable     | Not applicable | —        | Owning route               |

## Detailed findings

### T-01 — route policies are explicit and exhaustive

**Rating:** Aligned

**Priority:** Remediated in Phase 4

Every route declares render strategy and presentation policy in `APP_PAGE_REGISTRY`. `AppPageRoute` renders eager routes directly and gives only lazy routes a Suspense boundary; `AppRouteFallback` exhaustively resolves their waiting presentation.

**Remediation record:** The registry makes strategy reviewable and testable. Overview is eager; feature and access-specific routes stay lazy with intent prefetch and explicit fallbacks.

### T-02 — unknown route structures use progress only

**Rating:** Aligned

**Priority:** Remediated in Phase 4

The generic detailed skeleton has been removed. Progress routes preserve only structure known synchronously: shell, page frame, width preference, localized static header, known back navigation, and a bounded Level C content region.

**Remediation record:** The invented generic skeleton was replaced with page-framed Level C progress. Route-specific skeletons require a synchronously shared loaded structure.

### T-03 — shared loading foundations are adopted at page level

**Rating:** Aligned

**Priority:** Remediated in Phase 7

`AppLoadingSurface`, `AppSkeletonText`, `AppPageHomeView`, `ItemHistoryOverlay`, `EntityQueryFiltersOverlay`, and the relation value editor now consume the applicable shared loading boundary and skeleton contracts.

**Remediation record:** The remaining overlay and widget owners now centralize reveal timing and announcements while shared visual leaves stay silent.

### T-04 — Overview proves and verifies the structural pattern

**Rating:** Aligned

**Priority:** Remediated in Phase 6

Overview shares one real page structure across loading and loaded modes. `AppSkeletonText` paints one skeleton fragment per real wrapped line while preserving the same localized typography boxes. Page width flows through `AppPageLayout`, and one shared boundary owns delay, `aria-busy`, and announcement semantics.

**Remediation record:** The browser alignment matrix compares the real loaded and loading anchors for `md`, `lg`, `xl`, and `full` widths in English and Croatian under light and dark schemes. Storybook runs the matrix at 1440 × 900 and 390 × 844, with its shell navigation context derived from the same `md` breakpoint as the application. An additional browser project forces `prefers-reduced-motion: reduce`, and the contract asserts that skeleton animation is disabled. Loaded-to-loading transitions are measured through the Layout Instability API with an explicit Level A threshold.

### T-05 — Items initial loading preserves the workflow frame

**Rating:** Aligned

**Priority:** Remediated in Phase 5

Search, filters, page frame, table/list frame, headings, and pagination remain in place. Initial row placeholders are selected only when there is no usable data. The result-count chip remains mounted in a bounded reserved slot, and the shared table owns delayed skeleton timing while deriving desktop and mobile placeholders from real row/cell structures.

**Remediation record:** Focused integration tests cover initial/loading/empty/error/refresh states plus compact mobile loading at small density. Storybook exposes the canonical state matrix and a browser geometry contract for the page, toolbar, data region, table, and desktop count slot.

### T-06 — Items refresh and error ownership are explicit

**Rating:** Aligned

**Priority:** Remediated in Phase 5

`useItemSearchQuery` distinguishes `isLoading`, `isRefreshing`, and `isFetchingNextPage`, retains previous data, and exposes local retry. Initial loading is owned by the shared table; retained refresh is owned by one enclosing `VireoLoadingRegion`; incremental mobile fetching remains table-local. First-load errors replace the table's ordinary empty state, while refresh errors retain rows and provide a warning with retry.

**Remediation record:** Initial loading, retained refresh, incremental pagination, empty, initial error, and retained refresh-error now have mutually coherent ownership and recovery behavior.

### T-07 — Item history duplicates layout in a separate skeleton tree

**Rating:** Aligned
**Priority:** Remediated in Phase 7

The overlay frame and title remain stable. Initial loading renders the public `VireoHistoryEntry` loading mode, which reuses the real entry frame, header, expanded body, column headings, and field-row anatomy. One enclosing `VireoLoadingRegion` owns delayed visibility, busy semantics, and the announcement.

**Remediation record:** Loaded records remain during refresh, a subtle decorative progress line communicates retained work, and initial error, stale-data error, retry, and empty states are covered by integration tests.

### T-08 — filter-definition progress lacks complete boundary semantics

**Rating:** Aligned
**Priority:** Remediated in Phase 7

Because the server determines the filter schema, initial loading uses a reserved progress-only Level C region. The smallest stable content region owns busy/status semantics, while refresh retains the real definition-backed form and uses a decorative progress line.

**Remediation record:** Initial failure and retained-definition refresh failure are distinct, recoverable states; stale usable content remains operable.

### T-09 — relation-option loading has no visible recovery contract

**Rating:** Aligned
**Priority:** Remediated in Phase 7

The relation autocomplete preserves its frame, input, and selected values during option loading. It now distinguishes loading, valid empty results, initial failure, and cached-option refresh failure.

**Remediation record:** One local loading region owns busy/status semantics, both error modes expose retry, and retained cached options remain usable.

### T-10 — bootstrap and login-route ownership are distinct

**Rating:** Aligned

**Priority:** Remediated in Phase 4

Authentication bootstrap and login route-code loading now provide separate labels through the same presentation primitive. Each uses one stable busy region and reveals its progress indicator and polite status through the shared delay contract.

**Remediation record:** Bootstrap and login route loading retain separate labels while sharing the same application-progress presentation primitive and boundary semantics.

### T-11 — verification now includes the Items reference workflow

**Rating:** Aligned

**Priority:** P1

Overview and Items have Storybook alignment and unexpected-layout-shift contracts. Overview exercises both supported locales, both color schemes, all page-width preferences, real compact/desktop browser viewports, and an explicit reduced-motion assertion. Items exercises loaded, initial loading, refreshing, empty, initial error, retained refresh-error, compact mobile loading, small density, retry, delayed visibility, announcement uniqueness, and a bounded CLS threshold. Phase 7's focused transition, retention, error/retry, empty, duplicate-action, and accessibility-ownership coverage remains mandatory for history, filter-definition, relation-option, item-form, deletion, and login surfaces.

**Phase 8 enforcement record:** Storybook accessibility violations fail in ordinary desktop/mobile and reduced-motion projects. Async canonical stories declare loading category and geometry metadata. Architecture checks reject undeclared async story contracts, raw MUI skeleton imports, and standalone page-skeleton trees. The component generator and public-component registry in Starter enforce the same classification at the reusable layer, and both repositories provide a loading-state PR checklist.

## State-transition coverage baseline

| Transition                                    | Best current reference                | Gap                                                                              |
| --------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| Initial loading → content                     | Overview and Items                    | Width, locale, viewport, theme, motion, geometry, and CLS contracts are covered. |
| Initial loading → empty                       | Items and async-state example         | Items is covered; other query boundaries remain inconsistent.                    |
| Initial loading → error                       | Items and Phase 7 overlays            | Covered for current data-owning reference surfaces.                              |
| Content → refresh → updated                   | Items                                 | Retention, ownership, and state coverage are aligned.                            |
| Content → refresh error with retained content | Items and Phase 7 overlays            | Covered for history, filter definitions, and relation options.                   |
| Content → mutation → success/error            | Item form, delete confirmation, login | Real context is retained and unsafe duplicate/close actions are prevented.       |
| Route code → destination                      | Eager Overview and page progress      | Overview has no route wait; lazy routes preserve known anchors while loading.    |

## Remediation order

1. **Route contract (complete):** typed per-route policies replace the invented generic fallback with a compliant Level C treatment.
2. **Starter foundation adoption (complete for Phase 4 surfaces):** route, bootstrap, and Overview loading use shared boundaries, tokens, and skeleton leaves.
3. **Items pilot (complete):** responsive-table integration, result-count geometry, exclusive error/empty behavior, refresh ownership, recovery, and canonical stories.
4. **Overview return (complete):** refine multiline leaves and verify exact geometry across locale, page width, compact, and desktop scenarios.
5. **Overlay migration (complete):** item history, filter definition, and relation-option states now have explicit loading, refresh, empty/error, recovery, accessibility, and geometry ownership.
6. **Busy-action integration (complete):** item form, deletion, and login flows retain context and prevent unsafe duplicate actions through the shared Starter contracts.
7. **Verification and enforcement (complete):** theme, reduced-motion, CLS, accessibility, localization, authoring, and architecture checks run in the authoritative gates.
8. **Separate route strategy review (complete):** Overview is eager; routes with meaningful feature, access, or infrequent-use boundaries remain lazy and prefetch on intent.

## Phase 2 exit record

- [x] All 22 routes inventoried; one eager and 21 lazy strategies are explicit.
- [x] Route-code, initial-data, refresh, pagination, mutation, empty, and error states separated.
- [x] Application loading surfaces classified.
- [x] Geometry targets assigned.
- [x] Accessibility and announcement ownership gaps recorded.
- [x] Remediation priorities and repository owners assigned.
- [x] Eager-versus-lazy strategy reviewed after visual contracts stabilized.
- [x] Phase 4 route-policy and page-loading convention findings remediated.
- [x] Phase 5 Items data-workflow pilot remediated and verified.
- [x] Phase 6 Overview visual leaves and width/locale/viewport geometry remediated and verified.
- [x] Phase 7 overlay, widget, and busy-action vertical slices remediated and verified.
- [x] Cross-theme, reduced-motion, CLS, accessibility, localization, authoring, and architecture findings remediated in Phase 8.
