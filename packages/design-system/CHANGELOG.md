# @openchoreo/backstage-design-system

## 1.3.0

### Minor Changes

- f39a20c: Add app-config-driven branding groundwork: `resolveBrandTokens(base, brand?)`
  pure helper (brand primary → derived token slots; identity when no overrides)
  and `ChoreoTokensProvider` with a context-aware `useChoreoTokens`. The portal
  app gains an `app.branding.*` frontend-visible config schema (name, iconLogo,
  fullLogo, theme.light/dark.primaryColor) wired into the theme providers,
  sidebar logos, and sign-in card. Default behavior with no branding config is
  unchanged.
- 4c7f96c: Add an **Audit Logs** sidebar page that reads the observer's audit trail — who
  changed what, where, and whether it was allowed.

  A top-level page rather than an entity tab: the trail spans every namespace and
  the observer evaluates `auditlogs:view` at cluster scope, so the tenancy filters
  in a query narrow the result set without widening what the caller may read.

  - **Data layer**: `ObservabilityClient` gains `queryAuditLogs` and
    `queryAuditLogFilterValues`, typed against the observer's `AuditLogs`
    operations. Record fields keep their snake_case spelling and the query's own
    controls stay camelCase, so a response can be compared against an exported
    SIEM line key for key. The observer's distinguishable failures become typed
    errors — `501` (the adapter does not serve the trail) and `403` — because each
    asks the UI for a different answer and a flattened error string cannot carry
    them.
  - **Paging**: the API has no continuation token, so a page is continued by
    closing the window up to the last record read — `endTime` down when
    descending, `startTime` up when ascending. The window is half-open, so
    descending never repeats a record but cannot reach records sharing the
    boundary's exact `event_time` beyond one page's `limit`; ascending reaches all
    of them and repeats the boundary record, which the hook de-duplicates by
    `event_id`. A tie group wider than a page cannot move the boundary, so paging
    stops there rather than re-requesting the same window.
  - **Observer resolution**: the trail has no environment to resolve through, so
    `ObservabilityUrlResolver` gains `resolveForPlatform`, which reads the audit
    observer the API advertises at `/api/v1alpha1/metadata`, exposed as
    `GET /resolve-platform-urls`. An installation that reports audit logs disabled
    gets an empty state rather than a query error.
  - **Permission**: `openchoreo.auditlogs.view` → `auditlogs:view`, a cluster-scoped
    (non-resource) permission, with a `useAuditLogsPermission` hook.
  - **UI**: a query bar whose vocabulary is the filter set the API actually accepts
    — values are picked from the observer's own aggregation, one filter per request
    and only while a picker is open; outcome tiles counted on a faceted basis so
    selecting Denied does not zero the others; an opt-in stacked timeline; and a
    virtualized record table with a detail drawer whose values drill back into the
    query. Filters live in the URL, so a finding is a link.
  - **Shared components**: `TokenFilterBar` is added to
    `@openchoreo/backstage-plugin-react` — a view supplies its own vocabulary and
    a value provider, so nothing audit-specific reaches the shared package.
    `MultiSelectFilter` gains an optional `disabled` on an option, for a value a
    view cannot function without: it is shown checked, cannot be toggled, and
    survives Clear. Two changes to `TimeRangeFilter` affect every consumer
    (Runtime Logs, Platform Logs, Metrics, Traces): its dropdown panel is now at
    least as wide as the field it drops from, rather than narrower and offset,
    and its read-only trigger no longer lets a drag select part of the value.
  - **Performance**: rows are windowed (`@tanstack/react-virtual`) and memoized,
    the chart and drawer are `React.lazy`, the timeline aggregation is requested
    once per query rather than per page and not at all while the chart is
    collapsed, and Live polls only the newest page instead of every loaded one.

- 526e7ac: Make the Cost Insights scope filters (Namespaces, Projects, Components) read
  the way they behave, and improve the page's load time.

  - **Every option is ticked when the filter says "All".** Removed the earlier
    contradiction where nothing was selected when the filter said "All".
  - **One tier is narrowed at a time.** A dropdown is enabled once its parent
    holds a single item. A disabled trigger says on hover what to select to unlock it.
  - **Namespaces default to all**, rather than to the `default` namespace. A tier
    holding exactly one option reads as that option's name — `Namespaces: default`,
    instead of a bare "All".

  `MultiSelectFilter` gains four optional props for this: `showOnlyAction` (a
  per-row **Only** action, so narrowing an all-ticked list to one value is one
  click), `hideClear` (for filters where an empty selection is not a state),
  `disabledHint` (tooltip explaining why the filter is disabled), and
  `nameSoleOption` (a lone option shows its name instead of "All"). All four
  default to off, so existing consumers are unaffected.

  Each environment's cost requests are parallelized rather than awaited in sequence.

  Cost Insights now opens on the last 24 hours at 1-hour granularity, so the
  time-series charts land on a readable number of buckets instead of one.

- d00d48b: Improve the Cost Insights view UX.

  - **Single page**: removed the Table/Graphs toggle - the graphs and the cost
    table now render on one page (table after the graphs), and the Total Cost /
    Forecast this month / Efficiency tiles were removed.
  - **Accumulated cost & forecast chart**: the former "Spend forecast" chart is
    renamed to **"Accumulated cost and forecast"** and reworked. It always covers the
    current calendar month (no longer affected by the time-range filter): it shows
    the actual cost accumulated from the 1st to today, then projects month-end
    spend at the current rate and if the recommendations are applied. The two
    forecast lines are now visually distinct (dashed vs dotted), and the axis ends on
    the month's last day. The time-range selector moved below this chart since it
    only drives the views under it.
  - **Cost vs efficiency**: added a "Potential savings" legend heading and removed
    the red low-efficiency shaded region.
  - **Refresh**: added a Refresh button to re-fetch cost data without a page
    reload.
  - **Scope filters**: the Project and Component filters now show "All" (not
    "None") when nothing is explicitly selected, since an empty selection
    aggregates everything. `MultiSelectFilter` gained an optional `emptyLabel`
    prop for this.
  - **Fixes**: the platform-level "not enabled" message now reads "Cost Insights
    have not been enabled" instead of the component-scoped observability message,
    and the numeric cost-table column headers are right-aligned with their values.
  - **Sidebar**: moved "Platform" and "Cost Insights" into their own
    divider-bounded section after "API", separating platform concerns from the
    main menu.

## 1.3.0-next.0

### Minor Changes

- f39a20c: Add app-config-driven branding groundwork: `resolveBrandTokens(base, brand?)`
  pure helper (brand primary → derived token slots; identity when no overrides)
  and `ChoreoTokensProvider` with a context-aware `useChoreoTokens`. The portal
  app gains an `app.branding.*` frontend-visible config schema (name, iconLogo,
  fullLogo, theme.light/dark.primaryColor) wired into the theme providers,
  sidebar logos, and sign-in card. Default behavior with no branding config is
  unchanged.
- 4c7f96c: Add an **Audit Logs** sidebar page that reads the observer's audit trail — who
  changed what, where, and whether it was allowed.

  A top-level page rather than an entity tab: the trail spans every namespace and
  the observer evaluates `auditlogs:view` at cluster scope, so the tenancy filters
  in a query narrow the result set without widening what the caller may read.

  - **Data layer**: `ObservabilityClient` gains `queryAuditLogs` and
    `queryAuditLogFilterValues`, typed against the observer's `AuditLogs`
    operations. Record fields keep their snake_case spelling and the query's own
    controls stay camelCase, so a response can be compared against an exported
    SIEM line key for key. The observer's distinguishable failures become typed
    errors — `501` (the adapter does not serve the trail) and `403` — because each
    asks the UI for a different answer and a flattened error string cannot carry
    them.
  - **Paging**: the API has no continuation token, so a page is continued by
    closing the window up to the last record read — `endTime` down when
    descending, `startTime` up when ascending. The window is half-open, so
    descending never repeats a record but cannot reach records sharing the
    boundary's exact `event_time` beyond one page's `limit`; ascending reaches all
    of them and repeats the boundary record, which the hook de-duplicates by
    `event_id`. A tie group wider than a page cannot move the boundary, so paging
    stops there rather than re-requesting the same window.
  - **Observer resolution**: the trail has no environment to resolve through, so
    `ObservabilityUrlResolver` gains `resolveForPlatform`, which reads the audit
    observer the API advertises at `/api/v1alpha1/metadata`, exposed as
    `GET /resolve-platform-urls`. An installation that reports audit logs disabled
    gets an empty state rather than a query error.
  - **Permission**: `openchoreo.auditlogs.view` → `auditlogs:view`, a cluster-scoped
    (non-resource) permission, with a `useAuditLogsPermission` hook.
  - **UI**: a query bar whose vocabulary is the filter set the API actually accepts
    — values are picked from the observer's own aggregation, one filter per request
    and only while a picker is open; outcome tiles counted on a faceted basis so
    selecting Denied does not zero the others; an opt-in stacked timeline; and a
    virtualized record table with a detail drawer whose values drill back into the
    query. Filters live in the URL, so a finding is a link.
  - **Shared components**: `TokenFilterBar` is added to
    `@openchoreo/backstage-plugin-react` — a view supplies its own vocabulary and
    a value provider, so nothing audit-specific reaches the shared package.
    `MultiSelectFilter` gains an optional `disabled` on an option, for a value a
    view cannot function without: it is shown checked, cannot be toggled, and
    survives Clear. Two changes to `TimeRangeFilter` affect every consumer
    (Runtime Logs, Platform Logs, Metrics, Traces): its dropdown panel is now at
    least as wide as the field it drops from, rather than narrower and offset,
    and its read-only trigger no longer lets a drag select part of the value.
  - **Performance**: rows are windowed (`@tanstack/react-virtual`) and memoized,
    the chart and drawer are `React.lazy`, the timeline aggregation is requested
    once per query rather than per page and not at all while the chart is
    collapsed, and Live polls only the newest page instead of every loaded one.

- 526e7ac: Make the Cost Insights scope filters (Namespaces, Projects, Components) read
  the way they behave, and improve the page's load time.

  - **Every option is ticked when the filter says "All".** Removed the earlier
    contradiction where nothing was selected when the filter said "All".
  - **One tier is narrowed at a time.** A dropdown is enabled once its parent
    holds a single item. A disabled trigger says on hover what to select to unlock it.
  - **Namespaces default to all**, rather than to the `default` namespace. A tier
    holding exactly one option reads as that option's name — `Namespaces: default`,
    instead of a bare "All".

  `MultiSelectFilter` gains four optional props for this: `showOnlyAction` (a
  per-row **Only** action, so narrowing an all-ticked list to one value is one
  click), `hideClear` (for filters where an empty selection is not a state),
  `disabledHint` (tooltip explaining why the filter is disabled), and
  `nameSoleOption` (a lone option shows its name instead of "All"). All four
  default to off, so existing consumers are unaffected.

  Each environment's cost requests are parallelized rather than awaited in sequence.

  Cost Insights now opens on the last 24 hours at 1-hour granularity, so the
  time-series charts land on a readable number of buckets instead of one.

- d00d48b: Improve the Cost Insights view UX.

  - **Single page**: removed the Table/Graphs toggle - the graphs and the cost
    table now render on one page (table after the graphs), and the Total Cost /
    Forecast this month / Efficiency tiles were removed.
  - **Accumulated cost & forecast chart**: the former "Spend forecast" chart is
    renamed to **"Accumulated cost and forecast"** and reworked. It always covers the
    current calendar month (no longer affected by the time-range filter): it shows
    the actual cost accumulated from the 1st to today, then projects month-end
    spend at the current rate and if the recommendations are applied. The two
    forecast lines are now visually distinct (dashed vs dotted), and the axis ends on
    the month's last day. The time-range selector moved below this chart since it
    only drives the views under it.
  - **Cost vs efficiency**: added a "Potential savings" legend heading and removed
    the red low-efficiency shaded region.
  - **Refresh**: added a Refresh button to re-fetch cost data without a page
    reload.
  - **Scope filters**: the Project and Component filters now show "All" (not
    "None") when nothing is explicitly selected, since an empty selection
    aggregates everything. `MultiSelectFilter` gained an optional `emptyLabel`
    prop for this.
  - **Fixes**: the platform-level "not enabled" message now reads "Cost Insights
    have not been enabled" instead of the component-scoped observability message,
    and the numeric cost-table column headers are right-aligned with their values.
  - **Sidebar**: moved "Platform" and "Cost Insights" into their own
    divider-bounded section after "API", separating platform concerns from the
    main menu.

## 1.2.0

### Minor Changes

- 453b958: Show a "Suspended" status in the deployment pipeline when a component's workload is scaled to zero. The backend reads the suspended state that core already reports on the ReleaseBinding's ResourcesReady condition, and the pipeline badge now shows "Suspended" instead of "Active" for a scaled-to-zero workload.
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
- 0d2433f: Fix sidebar section separators rendering as dark near-black lines in production
  builds. The softening rule targeted the divider by its `BackstageSidebarDivider-root`
  class prefix, which JSS mangles away in the production bundle; it now targets the
  sidebar-nav `hr` element directly, so the light-mode divider stays a subtle grey in
  both dev and prod.
- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 14601f4: Clarify the save/discard/delete controls in the Workload editor rows
  (endpoints, dependencies, environment variables, and file mounts). While
  editing a row, a labeled footer bar (Save / Cancel / Delete) makes committing
  or discarding clearly visible; read-only rows keep their compact inline
  Edit / Delete buttons on a single line. Adds a reusable `EditRowActions`
  design-system component shared by all of those row editors.
- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

## 1.2.0-next.3

### Minor Changes

- 453b958: Show a "Suspended" status in the deployment pipeline when a component's workload is scaled to zero. The backend reads the suspended state that core already reports on the ReleaseBinding's ResourcesReady condition, and the pipeline badge now shows "Suspended" instead of "Active" for a scaled-to-zero workload.
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
- 0d2433f: Fix sidebar section separators rendering as dark near-black lines in production
  builds. The softening rule targeted the divider by its `BackstageSidebarDivider-root`
  class prefix, which JSS mangles away in the production bundle; it now targets the
  sidebar-nav `hr` element directly, so the light-mode divider stays a subtle grey in
  both dev and prod.
- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 14601f4: Clarify the save/discard/delete controls in the Workload editor rows
  (endpoints, dependencies, environment variables, and file mounts). While
  editing a row, a labeled footer bar (Save / Cancel / Delete) makes committing
  or discarding clearly visible; read-only rows keep their compact inline
  Edit / Delete buttons on a single line. Adds a reusable `EditRowActions`
  design-system component shared by all of those row editors.

## 1.2.0-next.0

### Patch Changes

- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

## 1.1.1

- Design system updates supporting the Project Contents card on the project overview page. (#590)

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
