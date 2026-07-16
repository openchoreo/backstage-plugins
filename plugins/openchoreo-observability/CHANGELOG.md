# @openchoreo/backstage-plugin-openchoreo-observability

## 1.2.0-next.3

### Minor Changes

- af359bd: Add the `useComponentHasAnyCiliumEnabledEnvironment` hook, which resolves on the client whether any of a component's project environments runs Cilium — it fetches the project's environments and probes each backing DataPlane's `networkpolicyprovider` (the same source the Wirelogs page uses to enable/disable individual environments). It returns `false` until the probe confirms at least one Cilium environment.

  The portal uses this to hide the component-level **Wirelogs** tab unless at least one environment runs Cilium (wirelogs are sourced from Cilium Hubble). Previously the tab was always shown and, on a core OpenChoreo setup with no Cilium DataPlanes, rendered an empty "configure Cilium" state — a dead tab with no usable content. Resolving availability at render time means no catalog-sync annotation or DataPlane event cascade is required.

### Patch Changes

- 591df85: Show a subtle background-refresh indicator on cached views instead of swapping
  data in silently.

  Adds a shared `RefreshOverlay` primitive to the design system — a small
  top-right spinner (or thin top bar) that overlays a positioned container while a
  background revalidation runs, without shifting or blanking the cached content.
  `useOpenChoreoQuery`/`useOpenChoreoInfiniteQuery` already expose `isRefetching`;
  the data hooks across the portal now thread it through, and the home dashboard,
  plane cards, access-control, secrets, project, environment, workflow and
  observability surfaces render the overlay from it. `SummaryWidgetWrapper` gained
  a `refreshing` prop so the home summary widgets get it for free.

- 62608f5: chore: remove dead code left over from the OpenAPI-client and New Frontend
  System migrations — commented-out blocks, orphaned files/components, and unused
  deprecated exports (`LogEntry`/`RuntimeLogsResponse` aliases, `FILTER_PRESETS`,
  `useOrgName`, `useRCAReportByAlert`, `UserTypeConfig`), plus consolidation of
  duplicated backend response-type wrappers. No behavioural changes.
- 7da3c7d: Convert the RCA chat to a right drawer where previously it was inbuild to the page
- 4dd5d2a: Rename RCA agent chat to Portal Assistant
- e3986a9: Add an `/alpha` entry point that exposes each plugin as a `createFrontendPlugin` for use with Backstage's New Frontend System (NFS). The default entry continues to export the legacy `createPlugin` instance so existing host apps keep working unchanged; adopters on NFS can now import `from '@openchoreo/backstage-plugin-<name>/alpha'` and include the plugin directly in `createApp({ features: [...] })`.

  The `/alpha` exports register each plugin's API factories (e.g. `openChoreoCiClientApiRef`, `genericWorkflowsClientApiRef`, the three observability backend clients, `openChoreoClientApiRef`) and one top-level page where applicable (`platform-engineer-core`'s dashboard view, `openchoreo-workflows`' generic workflows page, `openchoreo-ci`'s workflows entity tab).

  Entity tabs and overview cards that previously lived in the host's `EntityPage.tsx` now ride through each plugin's `/alpha` export as `EntityContentBlueprint` and `EntityCardBlueprint` extensions, with the right kind filters. Adopters on `/alpha` get the full entity-page contributions automatically: the OpenChoreo CI plugin contributes the Build tab (scoped to `kind:component`); the observability plugin contributes the 10 component- and system-page tabs (Logs, Events, Metrics, Alerts, Wirelogs, Traces, Incidents, RCA Reports, Cost Analysis) plus a registry API for host-injected log-row action renderers; the OpenChoreo plugin contributes the Deploy tab, the system Cell Diagram tab, the shared Resource Definition tab, and 30+ overview cards spanning every OpenChoreo platform kind (Environment, DataPlane, WorkflowPlane, ObservabilityPlane, DeploymentPipeline, the ComponentType / ResourceType / TraitType families, and the Workflow family); the generic-workflows plugin contributes the Runs tab on `Workflow` and `ClusterWorkflow` entities of type `Generic`. The react plugin exposes a new `FeatureGatedContent` component so plugin authors can gate routable extensions on the OpenChoreo feature flags without rolling their own empty-state wrapper.

  Custom catalog-graph relations, entity-presentation kind icons, and the scaffolder form-decorator override are now actually applied at runtime — the original migration registered them but they were silently overwritten by upstream defaults at startup. The form-decorator override also stops dropping decorators contributed by other plugins.

  Adopters still on the default (legacy) export are unaffected. This addresses the body of [openchoreo/openchoreo#3568](https://github.com/openchoreo/openchoreo/issues/3568) — adopters can drop `--legacy` from the `@backstage/create-app` step when installing the plugin suite into an existing Backstage host.

- d5eff9e: Replace the generic "No environments found. Make sure your component is properly configured." message on the observability pages (Runtime Logs, Runtime Events, Alerts, Wirelogs, Metrics, Traces, Incidents, Cost Analysis, RCA — component and project scoped) with cause-specific messaging. `useProjectEnvironments` now reports a discriminated status — `empty-pipeline` (the deployment pipeline has no environments), `forbidden` (permission to view the pipeline is denied), or `unavailable` (the pipeline is missing or couldn't be loaded) — and the pages render a cause-specific state via a shared `EnvironmentsStatusNotice` component, using the standard Backstage `EmptyState` (matching the Deploy tab). A missing `deploymentPipelineRef` now returns a clean 404 instead of a 500.
- 591df85: Introduce a frontend response cache (TanStack Query) behind a swappable seam and
  migrate the portal's data-fetching hooks onto it, so cached data paints
  instantly on remount and a background refresh no longer blanks the view.

  New hooks in `@openchoreo/backstage-plugin-react`, all wrapping TanStack Query so
  plugins never import it directly:

  - `useOpenChoreoQuery` — cached reads, returning the
    `{ data, loading, isRefetching, error, refetch }` shape the loaders consume.
  - `useOpenChoreoMutation` — writes that re-throw on error and invalidate cached
    queries on success (replacing the hand-rolled "call verb then refetch").
  - `useOpenChoreoInfiniteQuery` — cursor-paginated "load more + live poll" lists
    (runtime logs/events).
  - `useOpenChoreoCache` — imperative cache access for optimistic writes and the
    lazy, dynamically-keyed hooks.

  Migrated across the openchoreo, observability, CI and workflows plugins: simple
  and parameterized reads, read+mutation hooks, `setInterval` pollers (now
  `refetchInterval` with terminal stop conditions), lazy/conditional and
  keyed-Map hooks, the log/event pagination trio, and the `react-use` `useAsync`
  sites. `useAsyncOperation` is deprecated in favour of `useOpenChoreoMutation`.
  The provider is mounted in the app root and the cache is cleared on sign-out.

  The seam only forwards `staleTime`/`refetchInterval`/`enabled` when a caller
  actually sets them — passing an explicit `undefined` overrides the QueryClient
  default instead of inheriting it, which resolved `staleTime` to 0 and refetched
  on every remount, silently defeating the shared 30s cache.

  The cell-diagram and wirelogs environment hooks no longer fold `isRefetching`
  into `loading`; a background refresh kept re-showing their full skeleton (the
  "blank on refresh" the cache was meant to remove). They now report `loading`
  for the first load only and expose `isRefetching` separately.

- 915e2e5: Self-contain the response cache for NFS-mounted OpenChoreo surfaces. Each
  OpenChoreo plugin now wraps its own extensions in a TanStack Query
  `QueryClientProvider` via `PluginWrapperBlueprint`, around a shared `queryClient`
  singleton exported from `@openchoreo/backstage-plugin-react`. A host that mounts
  the plugins' `/alpha` features (auto-mounted entity tabs/cards and the standalone
  plugin pages) gets response caching with no provider wiring — previously those
  surfaces would crash with "No QueryClient set" when a cached tab rendered.

  Scope: this covers surfaces rendered through a plugin's own extension boundary
  (NFS auto-mounted tabs/cards and standalone plugin pages). A host that instead
  composes OpenChoreo tab components itself via legacy `EntityLayout.Route` JSX
  renders them outside the plugin wrapper, so that host still mounts its own
  provider — `OpenChoreoQueryProvider` (also exported here) bundles the
  `QueryClientProvider` and the user-scoping context for that case.

  Cross-user isolation is structural: every cache key is namespaced by the
  signed-in user's entityRef inside the cache seam (`useOpenChoreoQuery`,
  `useOpenChoreoInfiniteQuery`, `useOpenChoreoMutation`, `useOpenChoreoCache`), so
  a different user occupies a disjoint key space and can never read the previous
  user's permission-scoped responses from the cache — no cache-clearing needed.
  Multiple OpenChoreo plugins share the same `queryClient`, so there is one cache.

- d89f030: Fix trace span details never loading from cache. The span cache key included
  the filter scope and time window, whose timestamps changed every render, so the
  key used to read spans (`getSpans`) no longer matched the one they were cached
  under and always returned `undefined`. Spans are now keyed by trace id alone —
  a trace id uniquely identifies its spans regardless of the query scope.
- c572a46: Unify portal loading states behind a shared, token-driven system so every
  loader looks and behaves consistently.

  **New shared components**

  - **design-system**: `Skeleton` (token-driven shimmer — `text`/`rect`/`circle`
    with a `count` for stacked lines, backed by new `motion` timing tokens),
    `Spinner` (theme-coloured circular loader with named sizes
    `chip`/`button`/`inline`/`page`), and `PageLoader` (centered `Spinner` for
    page/route/section loads).
  - **backstage-plugin-react**: `ContentLoader` (loading/error/empty/content
    wrapper that keeps content on screen and overlays a spinner during a
    background refetch instead of blanking) and `SkeletonRows` (table-body
    skeleton helper).

  **Consistency changes**

  - Tables now show skeleton rows instead of a circular overlay (catalog,
    Project Contents, namespace cards, observability RCA/Cost Analysis, and the
    raw-MUI alert/incident/log tables).
  - Overview cards and widgets render skeleton placeholders via the shared
    `Skeleton` (including the home-page platform-planes section).
  - Page-level loaders use the centered `PageLoader` instead of the Backstage
    progress bar — including Backstage's internal route/Suspense fallback and the
    app-boot loader.
  - Status chips use the themed `Spinner` (removing a hardcoded spinner colour).
  - The shared `ErrorState` icon is sized down to read proportionately in
    section-level errors.

  Prefer `Skeleton`/`Spinner`/`PageLoader` and `ContentLoader` over raw MUI
  `Skeleton`/`CircularProgress`/`Progress` for new loading states.

- 5741d00: Limit how long a wirelogs stream can run. Wirelogs (Cilium Hubble flows) previously streamed indefinitely — there's no upstream timeout, so a forgotten tab could hold an open SSE connection for hours and degrade the browser.

  The backend `/wirelogs/stream` proxy now enforces a hard cap (default 15 minutes, configurable via `openchoreo.observability.wirelogs.streamTimeoutSeconds`): it advertises the cap to the client in a `meta` SSE frame and, on hitting it, sends a `timeout` frame before closing so the UI can label the stop precisely. The wirelogs view layers graduated soft warnings over this — confirmation dialogs at roughly one-third and two-thirds of the cap let the user stop early or knowingly continue, and a toast explains when the server ends the stream (the Start button resumes a fresh session).

- Updated dependencies [591df85]
- Updated dependencies [c86de7f]
- Updated dependencies [18e51cf]
- Updated dependencies [62608f5]
- Updated dependencies [cf2203a]
- Updated dependencies [8381554]
- Updated dependencies [39d264c]
- Updated dependencies [0d2433f]
- Updated dependencies [8381554]
- Updated dependencies [e3986a9]
- Updated dependencies [383e7f6]
- Updated dependencies [d5eff9e]
- Updated dependencies [8416223]
- Updated dependencies [71f7b6c]
- Updated dependencies [2f45e83]
- Updated dependencies [14601f4]
- Updated dependencies [591df85]
- Updated dependencies [915e2e5]
- Updated dependencies [284fcd7]
- Updated dependencies [453b958]
- Updated dependencies [c572a46]
  - @openchoreo/backstage-design-system@1.2.0-next.3
  - @openchoreo/backstage-plugin-react@1.2.0-next.3
  - @openchoreo/backstage-plugin-common@1.2.0-next.3

## 1.2.0-next.2

### Patch Changes

- d19ffcf: Virtualize the log/event/trace/wirelog views with a new shared `VirtualizedLogList` primitive.

  **New shared primitive (`@openchoreo/backstage-plugin-react`)**

  `VirtualizedLogList` is a headless windowed list built on `@tanstack/react-virtual`. It handles row windowing, automatic variable/wrapped row-height measurement (via `measureElement`), follow-tail for live streams, scroll-driven load-more (`onReachEnd`), and exposes `header` / `footer` slots that render inside the scroll container so they share the rows' content width and stay aligned with the body cells.

  Alongside the primitive, three small hooks/utilities the consumers compose with:

  - `useRowExpansion()` — tracks expanded row keys in a Set lifted to the parent table, so per-row expansion survives the virtualizer unmounting off-screen rows.
  - `useAutoLoadWhenEmpty({ count, hasMore, loading, onLoadMore })` — fires `onLoadMore` once when the list is empty but the server reports more pages, restoring the IntersectionObserver-equivalent "auto-fetch when the sentinel is visible" behaviour now that there is no DOM sentinel. Re-arms on count transitions, doesn't loop on repeated empty responses.
  - `makeColumnStyle<K>(flexByKey)` — factory that builds the `getColumnStyle(key)` helper for the div-based tables. Memoizes style objects per key so cell renders return stable references.

  **Surfaces virtualized**

  - **Build Logs** (`openchoreo-ci` `LogsContent`) — per-step build log viewer with accordion sections. Single fetch per step plus periodic polling.
  - **Workflow Run Step Logs** (`openchoreo-workflows`) — generic workflow run step logs. Follow-tail pinned to the bottom while a step is running.
  - **Runtime Logs** (`openchoreo-observability` `LogsTable` / `LogEntry`) — multi-column observability runtime logs. Sticky multi-column header, severity chips, expand-on-click rows, copy/investigate actions, infinite scroll wired through `onReachEnd` + `useAutoLoadWhenEmpty` (replacing the previous IntersectionObserver sentinel). The Phase-1/2 a11y attributes (`scope="col"`, `role="status"`/`aria-busy`/`aria-hidden`) carry across to the new div-based markup as `role="table"`/`role="row"`/`role="columnheader"` and the load-more spinner.
  - **Runtime Events** (`openchoreo-observability` `EventsTable` / `EventEntry`) — same shape as Runtime Logs (multi-column, expand-on-click, infinite scroll).
  - **Wirelogs** (`openchoreo-observability` `WirelogsTable`) — Cilium flow stream viewer. The previous hand-rolled `stickToBottomRef` + `useLayoutEffect` is replaced by the primitive's `followTail`, which catches both append and same-length cap-shift / dedupe / replace-by-uuid updates via last-item-key tracking.
  - **Traces** (`openchoreo-observability` `TracesTable`) — project-level traces with expand-on-click `WaterfallView`. Click events inside the waterfall are isolated from the row toggle.

  **Shared workflow-status helpers (`@openchoreo/backstage-plugin-common`)**

  `isTerminalStatus(status)` and `isStepLive(step, parentStatus)` replace four near-identical inline copies across `BuildLogs`, `BuildEvents`, `WorkflowRunStepLogs`, `WorkflowRunEvents`, and `RunMetadataContent`. One source of truth, case-insensitive matching, structurally-typed `isStepLive` so it accepts any `{ phase?: string }`-shaped step.

  **Notable behavioural notes**

  - Long runs paint faster and scroll smoothly — only the viewport's worth of rows is mounted regardless of payload size.
  - Wrapped multi-line log entries no longer overlap (auto-measured by tanstack instead of the previous hand-rolled measurement on top of react-window v1).
  - Per-row expanded state survives scrolling off-screen and back.
  - Live streams (running step logs, wirelogs) stay pinned to the newest row while the user is at the bottom; the tail releases as soon as they scroll up.
  - Load-more recovers from a server response of `hasMore: true` with no new rows: the user can scroll away and back to the bottom to re-trigger.

- Updated dependencies [d19ffcf]
  - @openchoreo/backstage-plugin-react@1.2.0-next.2
  - @openchoreo/backstage-plugin-common@1.2.0-next.2

## 1.2.0-next.0

### Minor Changes

- 529f13c: add component events view and hooks

### Patch Changes

- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

- Updated dependencies [529f13c]
- Updated dependencies [1207eda]
- Updated dependencies [7c76d05]
- Updated dependencies [8d8bd80]
  - @openchoreo/backstage-plugin-common@1.2.0-next.0
  - @openchoreo/backstage-plugin-react@1.2.0-next.0
  - @openchoreo/backstage-design-system@1.2.0-next.0

## 1.1.1

- HTTP metrics now refresh on refresh button click. (#595)

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
