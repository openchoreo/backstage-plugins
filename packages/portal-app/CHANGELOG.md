# @openchoreo/backstage-portal-app

## 1.4.0-m.1

### Minor Changes

- 9fa30bd: Make the portal shell installable by Backstage frontend feature discovery. The
  new `@openchoreo/backstage-portal-app/alpha` entry point default-exports a
  feature loader carrying the whole portal, and the package's `backstage.role`
  changes from `web-library` to `frontend-plugin-module` so discovery can see it.
  A host now installs the shell with a dependency plus `app.packages` in config,
  and needs no `features` array.

  A loader rather than a flat list of modules because that is the only shape
  discovery can consume — one package contributes one default export — and
  because a loader's features are spliced in at the loader's own position, in the
  order it returns them. The portal's three order-dependent pairs (API modules
  before the plugin-scoped `withOverrides`, Build before Deploy, Platform
  Overview before Platform Logs) therefore survive discovery, and are now pinned
  by tests instead of comments.

  `createPortalApp()` keeps working and is unchanged for callers. It now reads the
  same loader, so the two installation paths cannot drift, and using both at once
  is safe — feature loaders are de-duplicated by reference. Its `bindRoutes` is
  gone: all five bindings it declared are already the upstream `defaultTarget` of
  the external route refs involved, so `resolveRouteBindings` applies them
  anyway. `advanced.loadingElement` is the only thing the function still adds that
  a feature cannot.

- cdc4c6e: Support components with release lines.

  - Every component has an implicit `main` line, built from the component's own workload and bindings. Its other lines are ReleaseLine resources, synced to the catalog as a new `ReleaseLine` kind, part of their component and visible to whoever can view the component. They are not listed in the catalog viewer or search, and are reached from their component's Overview.
  - Components are created as before. Any component's context menu offers Create Release Line. Once a component has a release line, its Overview lists its lines, `main` first, with their environments, latest release and overrides. The component's own tabs work on the main line, which can't be edited, deleted or created. The names `main` and `default` are rejected for a new line: `main` is the implicit line, and `default` is reserved.
  - Each release line has its own page with the component's tabs (build, deploy, logs, metrics, ...) scoped to that line. Its Definition tab edits the properties the line overrides, next to the properties it inherits from the component, which are read-only and edited on the component's Definition page.
  - The `main` keyword is never written into a resource or request: releases, deploys, workload saves, dependencies and builds for the main line leave the release line empty. A dependency on a component with release lines picks the main line or one of its release lines, the main line unless chosen otherwise.
  - The project cell diagram shows the main line and each release line of a component as their own nodes, labelled with the component name and a pill with the line name, with a Release line filter. Dependencies link to the line they name, or to the main line, and gateway metrics are scoped per line. Clicking a line node opens the line's page.
  - Runtime logs, events, metrics, alerts, project logs, metrics, traces and incidents, cost insights and cost analysis reports get a Release line filter of All lines, `main` or one line, shown for a component with release lines. On a release line's page they are scoped to the line. Alert and incident details show the release line when there is one, and the observability API reports clearly when the installed FinOps module cannot filter costs by line.
  - The Delivery Insights page shows a Release line filter when the selected component has release lines, narrowing the metrics and the per-environment breakdown to `main` or one line.
  - An RCA report's Incident Overview shows the release line the alert fired on.
  - Cost analysis reports show their line in their overview and in the reports list, and link to the line's page and metrics, or the component's for the main line. Apply Recommendation names the release binding it updates and refuses a binding that belongs to another line.
  - Cost Insights applies a recommendation to the binding of the selected release line, and refuses a binding of another line. For a component with release lines, Apply is disabled until a line is chosen, since a recommendation for all lines matches no single binding.
  - Workflow runs returned by the workflows backend include their labels, so a run can be matched to its release line.
  - The environment overview lists each release line deployed in an environment as its own row, linked to the line's page, and Recent Deployments shows release lines next to components. `GET /release-bindings` returns the main line's bindings without a line, and every line's with `allReleaseLines=true`.
  - The unused `promoteToEnvironment` client method and the backend `/promote-deployment` route are removed. The OpenChoreo API no longer has the promote endpoint they called, and the Promote action deploys through the release binding instead.
  - A new release line's Workload and bindings are named as OpenChoreo names a line's objects, `{component}-{line}-{hash}`, so they never take a name another component needs. Deploy, promote, saving overrides and removing a deployment find a line's binding by its owner (component, line and environment) rather than by name, since a binding created elsewhere may be named otherwise.

  Components without release lines behave as before.

### Patch Changes

- e6c00f2: The portal shell no longer wires the private Portal Assistant. Its drawer, assistant API factory, integration slots and log-row action now ship from the assistant plugin's own `/alpha` default export, installed by the `app` package — so the shell carries no dependency on the private plugin.
- 3275f94: Adopt the shipped Access Control and Secrets settings sub-pages instead of overriding the whole `/settings` page.

  Portal-app used to override `page:user-settings` with a hand-authored
  `OpenChoreoUserSettingsPage` so Auth Providers and Feature Flags would not
  appear. Now that `@openchoreo/backstage-plugin` contributes Access Control
  and Secrets as `SubPageBlueprint` extensions, portal-app does the same thing
  with far less code:

  - Drops the `page:user-settings` override and the `OpenChoreoUserSettingsPage`
    component.
  - Hides `sub-page:user-settings/auth-providers` and
    `sub-page:user-settings/feature-flags` through `app.extensions` in
    `app-config.yaml` and `app-config.production.yaml`.
  - Narrowly overrides `sub-page:user-settings/general` with a new
    `OpenChoreoGeneralSettings` component so the portal keeps the fourth
    `PlatformAboutCard` grid card next to upstream's Profile / Appearance /
    Identity cards.

  Net result is the same three visible tabs — General, Access Control, Secrets
  — but every host that installs the plugins now gets the OpenChoreo settings
  layout rather than only the portal.

- Updated dependencies [d19949b]
- Updated dependencies [92134d1]
- Updated dependencies [a9b2476]
- Updated dependencies [ac1813b]
- Updated dependencies [127f3d0]
- Updated dependencies [c15ee42]
- Updated dependencies [9e3a840]
- Updated dependencies [f5ca212]
- Updated dependencies [f5ca212]
- Updated dependencies [44795b9]
- Updated dependencies [c67978a]
- Updated dependencies [14f0837]
- Updated dependencies [11907a6]
- Updated dependencies [cdc4c6e]
- Updated dependencies [3275f94]
  - @openchoreo/backstage-plugin@2.0.0-next.0
  - @openchoreo/backstage-plugin-openchoreo-observability@2.0.0-next.0
  - @openchoreo/backstage-plugin-common@2.0.0-next.0
  - @openchoreo/backstage-plugin-react@2.0.0-next.0
  - @openchoreo/backstage-plugin-openchoreo-ci@2.0.0-next.0
  - @openchoreo/backstage-plugin-platform-engineer-core@2.0.0-next.0
  - @openchoreo/backstage-plugin-openchoreo-workflows@2.0.0-next.0
  - @openchoreo/backstage-design-system@2.0.0-next.0

## 1.3.0

### Minor Changes

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

- c2acee5: Add a composable home page built on Backstage's new frontend system. The home
  page (`page:home`, served at `/`) now uses a customizable widget grid: the
  default layout matches the previous home page (Your Starred Entities and
  Recently Visited), and users can add, move, resize and remove widgets — My
  Projects, Quick Actions and Recent Deployments — with their layout persisted
  per user via the StorageApi (UserSettings backend). The Platform Details
  section stays fixed outside the grid. Widgets are contributed via
  `HomePageWidgetBlueprint` and the layout via `HomePageLayoutBlueprint`.
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

- 45caff4: Reorganise the Cost Insights view into tabs and improve the graph/tooltip UX.

  - **Tabs**: the Cost Insights page now hosts two tabs — **Insights** (the
    existing table/graph views) and **Cost Analysis** (the FinOps report list,
    moved here from the project catalog entity page). The Cost Analysis tab
    reuses the existing `CostAnalysisPage` via a synthesised entity context and
    only enables its reports once a project scope is selected. The route is now
    `/cost-insights/*`, and the Incidents "View Cost Analysis" deep link points
    to the new location. The Cost Analysis tab was removed from the catalog
    system page (both the legacy `EntityPage` and the new-frontend-system
    `alpha` registration).
  - **Consistent header**: extracted the catalog entity header's gradient bar
    into a reusable `GradientPageHeader` (exported from
    `@openchoreo/backstage-plugin-react`), and used it for the Cost Insights
    header so its purple bar, title sizing and tab seam match the catalog.
    `CompactEntityHeader` now consumes the same shell. Breadcrumb level labels
    are pluralised (`namespaces` / `projects` / `components`) to match the
    catalog.
  - **Overview summary card**: the catalog Overview tab now shows a Cost
    Insights summary card at both the project and component levels,
    displaying the last-24-hour total cost (reusing the Total Cost card and,
    for a component, summed across its environments) with a "Go to Cost
    Insights" button that deep-links into the full view.
  - **Chart tooltips**: the stacked bar chart and the line chart tooltips now
    show the **Total** of the visible series and **highlight the row** for the
    segment/line under the pointer.
  - **Forecast clarity**: the "Forecast this month" summary card and the spend
    forecast chart gained an info tooltip explaining that the forecast projects
    the selected time window's rate across the month, so it can change with the
    chosen range and the amount of data available.

- 4389cde: Add a **Cost Insights** sidebar page that visualises the observer's
  per-environment FinOps (cost + right-sizing) data. The view is
  breadcrumb-scope driven (Namespace → Project → Component) with summary cards
  and a Table/Graph toggle at each level.

  - **Data layer**: `ObservabilityClient` gains `getCosts` /
    `getCostRecommendations` (resolving the observer URL per
    namespace+environment) plus `CostItem` / `CostRecommendationItem` types.
  - **Aggregation**: costs are fetched once per selected environment, plus one
    query over the previous equal-length window for deltas, then aggregated
    client-side — totals, cost-weighted efficiency, `% vs previous window`, and a
    current-month forecast by linear extrapolation. At the component level,
    right-sizing recommendations ("Cost After Optimizing") are attached
  - **UI**: breadcrumb scope switcher, environment multi-select, Table/Graph
    toggle, shared Time Range and graph-only granularity filters, summary cards, a
    sortable cost table (catalog-style column sorting, costs shown to 5 decimals
    so sub-cent values are visible), and a recharts stacked-bar graph over time.
    Wired into the portal sidebar and the `/cost-insights` route.

- c234b33: Add a **Delivery Insights** sidebar page showing the four DORA metrics, scoped
  by breadcrumb (Namespace → Project → Component). It sits alongside Cost
  Insights in the sidebar rather than on entity pages, since the audience is
  delivery leadership looking across an organisation rather than a developer
  working on one component.

  - **Metrics**: Deployment Frequency, Lead Time for Changes, Change Failure Rate
    and MTTR as KPI tiles with DORA classification, delta vs the previous equal
    window, and sparklines; a trend chart per metric at daily/weekly/monthly
    granularity (lead time shows p50/p75/p95).
  - **Drill-down**: a one-level-down breakdown table (namespace → projects,
    project → components, component → environments) sorted by deployment
    frequency, where each row carries its own metrics and an overall DORA rating
    (the scope's weakest tier). Project/component rows narrow the page scope;
    environment rows apply the environment filter.
  - **Per-environment cards** for the current scope, plus an environment filter
    and a "how these metrics are calculated" footnote.
  - **Bookmarkable views**: scope, range, granularity and environment all live in
    the URL, so a particular view can be shared or saved.
  - **Data layer**: `ObservabilityClient` gains `getDoraMetrics` /
    `getDoraDeployments` against the observer's
    `POST /api/v1alpha1/insights/dora/query` and
    `.../insights/dora/deployments/query`, called directly like the other
    observability APIs.
  - **URL resolution** gains namespace-level support: `/resolve-urls` now works
    without an `environmentName` by resolving through the namespace's
    environments (new `resolveForNamespace` in the client-node observability URL
    resolver), which is what the org-wide scope needs.
  - The namespace/project/component breadcrumb is now a shared `ScopeBreadcrumb`
    component used by both Delivery Insights and Cost Insights.

- 762b22a: Complete the New Frontend System migration for the portal shell and
  distribute scaffolder field extensions through the base plugin.

  **Portal**: `convertLegacyAppRoot` and `Root.tsx` are gone. Themes, icons,
  sidebar (`NavContentBlueprint`), provider stack, and every route now
  ship as NFS blueprints.

  **Adopter-facing additions**:

  - `@openchoreo/backstage-plugin/alpha` — `execTerminalPage`, 32
    `FormFieldBlueprint`s for OC template fields, plus new component
    exports (`ScaffolderPreselectionProvider`, `EntityWarningStrip`,
    `ForeignCardsSection`)
  - `@openchoreo/backstage-plugin-openchoreo-observability/alpha` —
    `costInsightsPage` with sidebar auto-discovery
  - `@openchoreo/backstage-plugin-platform-engineer-core/alpha` —
    `platformOverviewPage` with sidebar auto-discovery; `PlatformOverviewPage`
    source moved from portal-app
  - `@openchoreo/backstage-plugin-react` — `useQueryParams` (backwards-compat
    re-export left in `@openchoreo/backstage-plugin`)

### Patch Changes

- a958b80: Put the Delivery Insights page behind the `openchoreo.features.deliveryInsights`
  flag, off by default. It is a feature preview, and the page has nothing to show
  unless the Observer is separately configured to collect the data.
- 654b859: Fix the home page layout breaking on ~14" screens. The customizable widget grid
  defaulted `md` to 10 columns, which can't hold two width-6 cards, so the second
  card overlapped the first. `md` now uses 12 columns to keep the default cards
  side by side on wide screens, while smaller breakpoints stay narrow so the cards
  stack full-width.
- 6ccea2a: Add predefined home page card modules (not yet wired into the home page):

  - A home card registry + named layout configs (search, my-projects,
    quick-actions, recent-deployments, starred-entities, recently-visited,
    permission-gated platform-details) under `components/Home/cards`.
  - New `RecentDeploymentsCard` showing the latest releases across the user's
    components with per-environment status.
  - Shared `getRelativeTime` helper (also adopted by `RecentlyVisitedCard`).

  The current home page is unchanged; a follow-up will render it from the
  card registry.

- ce31a0e: Migrate entity pages to the Backstage New Frontend System. The hand-authored `EntityPage.tsx` in `packages/portal-app` (and its supporting files `EntityLayoutWithDelete.tsx`, `OpenChoreoCatalogEntityPage.tsx`, `WorkflowsOrExternalCICard.tsx`) is gone; tabs, cards, per-kind Overview layouts, and delete / annotation context menu items now ship as NFS blueprints from the plugins. Adopters installing `@openchoreo/backstage-plugin` in their own Backstage get the same OpenChoreo tabs and Overview grids as the portal automatically — no hand-authored `EntityPage.tsx` required.

  **New public exports from `@openchoreo/backstage-plugin`:**

  - `openChoreoEntityPageOverride` (from `/alpha`) — opt-in FrontendModule that swaps the canonical entity-page chrome for `OpenChoreoEntityLayout` (compact header + styled tab bar + delete / annotation menu items). Included by default in `@openchoreo/backstage-portal-app`. Adopters omit it to keep vanilla Backstage `<EntityLayout>` chrome — tabs and Overview layouts still work either way.
  - `OpenChoreoAboutCard`, `ContainedCatalogGraphCard`, `EntityRelationWarning` — previously portal-internal, now shipped as React components.

  **New NFS blueprints (all in `@openchoreo/backstage-plugin/alpha`):**

  - 18 `EntityContentLayoutBlueprint`s — one per OC-owned kind (Component, System, Domain, managed Resource, Environment, Dataplane / Cluster, WorkflowPlane / Cluster, ObservabilityPlane / Cluster, DeploymentPipeline, Component/Resource/Project/Trait Type families, Workflow / ClusterWorkflow, ComponentWorkflow). Each layout arranges bespoke OC cards in curated grid positions, then appends any adopter-contributed or upstream-default cards at the tail so third-party plugins compose visually.
  - 2 `EntityContextMenuItemBlueprint`s — permission-gated "Delete" and "Edit Annotations" actions. Both routes (canonical chrome + `openChoreoEntityPageOverride`) share the same presentational `DeleteEntityDialog` and `performEntityDelete` dispatch from PR #675.
  - `group` annotation on every `EntityContentBlueprint` (definition / deployment / runtime / analysis / external) for tab-ordering via `app.pages.entity.config`.
  - Upstream community CI plugins (`techdocs`, `jenkins`, `github-actions`, `gitlab`) registered so their annotation-gated tabs continue to appear on Component entities. The `api-docs/apis` and `techdocs` tabs are filter-tightened via app-side overrides so they only show when `providesApi`/`consumesApi` relations or `backstage.io/techdocs-ref` annotations are present (matching the pre-NFS `EntityPage.tsx` behavior).

  **Every OC blueprint is scoped to the `openchoreo.io/managed=true` label.** Two new helpers in `@openchoreo/backstage-plugin-common`: `isOpenChoreoManagedEntity` and `isOpenChoreoManagedOfKind(...kinds)`. Under NFS feature discovery, blueprints auto-attach — this label prevents OC UI leaking onto adopter entities of the same kind (Component, System, Domain, or any name that collides with an OC kind like `Environment`/`Workflow`) that aren't OC-owned.

  **Portal `app-config.yaml` and `app-config.production.yaml` add:**

  - `app.pages.entity.config.groups` — recommended tab ordering (overview / definition / deployment / runtime / analysis / external).
  - `app.extensions` — suppresses 20 upstream cards that duplicate OC layouts (`catalog/about`, `catalog/links`, `catalog/labels`, `catalog/depends-on-*`, `catalog/has-*`, `catalog-graph/relations`, `api-docs/*-apis`, `api-docs/providing-components`, `api-docs/consuming-components`, and 6 unconditional GitLab cards that throw when GitLab annotations are absent).

  See the README's Installation section for the recommended `app.pages.entity.config` block and per-extension override examples adopters can copy selectively.

- 9eb3d31: Register the Jenkins frontend plugin so the build-status card and tab work.
  `EntityLatestJenkinsRunCard` and `EntityJenkinsContent` are entity cards and
  tabs rather than routes, so `convertLegacyAppRoot` never discovered the plugin
  and `jenkinsApiRef` had no factory — the entity page threw
  `NotImplementedError: No implementation available for apiRef{plugin.jenkins.service2}`.
  Same fix already applied for api-docs and kubernetes.

  Also clarifies the scaffolder's CI identifier field: it takes a Jenkins job
  **full name** (`my-folder/my-job`), not a `/job/...` URL path. The plugin adds
  the `/job/` segments itself, so a URL-style value resolves to a folder literally
  named `job` and 404s.

- Updated dependencies [f39a20c]
- Updated dependencies [c142057]
- Updated dependencies [0133a8a]
- Updated dependencies [77c7a9c]
- Updated dependencies [f7fb9d2]
- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [67ba0da]
- Updated dependencies [854df53]
- Updated dependencies [526e7ac]
- Updated dependencies [6c8c373]
- Updated dependencies [202d582]
- Updated dependencies [d00d48b]
- Updated dependencies [093dabc]
- Updated dependencies [45caff4]
- Updated dependencies [4389cde]
- Updated dependencies [6648d25]
- Updated dependencies [c234b33]
- Updated dependencies [a958b80]
- Updated dependencies [2564efb]
- Updated dependencies [97be767]
- Updated dependencies [c2acee5]
- Updated dependencies [67ba0da]
- Updated dependencies [67ba0da]
- Updated dependencies [ce31a0e]
- Updated dependencies [762b22a]
- Updated dependencies [88cb693]
- Updated dependencies [0a7d538]
- Updated dependencies [2803441]
- Updated dependencies [36f0982]
- Updated dependencies [d7f12e6]
- Updated dependencies [cc2fe12]
- Updated dependencies [23f804a]
- Updated dependencies [435463f]
- Updated dependencies [6729dc3]
- Updated dependencies [0c85b6b]
  - @openchoreo/backstage-design-system@1.3.0
  - @openchoreo/backstage-plugin-openchoreo-observability@1.3.0
  - @openchoreo/backstage-plugin-common@1.3.0
  - @openchoreo/backstage-plugin-react@1.3.0
  - @openchoreo/backstage-plugin@1.3.0
  - @openchoreo/backstage-plugin-openchoreo-ci@1.3.0
  - @openchoreo/backstage-plugin-openchoreo-workflows@1.3.0
  - @openchoreo/backstage-plugin-platform-engineer-core@1.3.0
  - @openchoreo/backstage-plugin-openchoreo-portal-assistant@1.3.0

## 1.3.0-next.2

### Patch Changes

- Updated dependencies [0133a8a]
- Updated dependencies [854df53]
- Updated dependencies [88cb693]
  - @openchoreo/backstage-plugin-openchoreo-observability@1.3.0-next.2

## 0.2.0-next.0

### Minor Changes

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

- c2acee5: Add a composable home page built on Backstage's new frontend system. The home
  page (`page:home`, served at `/`) now uses a customizable widget grid: the
  default layout matches the previous home page (Your Starred Entities and
  Recently Visited), and users can add, move, resize and remove widgets — My
  Projects, Quick Actions and Recent Deployments — with their layout persisted
  per user via the StorageApi (UserSettings backend). The Platform Details
  section stays fixed outside the grid. Widgets are contributed via
  `HomePageWidgetBlueprint` and the layout via `HomePageLayoutBlueprint`.
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

- 45caff4: Reorganise the Cost Insights view into tabs and improve the graph/tooltip UX.

  - **Tabs**: the Cost Insights page now hosts two tabs — **Insights** (the
    existing table/graph views) and **Cost Analysis** (the FinOps report list,
    moved here from the project catalog entity page). The Cost Analysis tab
    reuses the existing `CostAnalysisPage` via a synthesised entity context and
    only enables its reports once a project scope is selected. The route is now
    `/cost-insights/*`, and the Incidents "View Cost Analysis" deep link points
    to the new location. The Cost Analysis tab was removed from the catalog
    system page (both the legacy `EntityPage` and the new-frontend-system
    `alpha` registration).
  - **Consistent header**: extracted the catalog entity header's gradient bar
    into a reusable `GradientPageHeader` (exported from
    `@openchoreo/backstage-plugin-react`), and used it for the Cost Insights
    header so its purple bar, title sizing and tab seam match the catalog.
    `CompactEntityHeader` now consumes the same shell. Breadcrumb level labels
    are pluralised (`namespaces` / `projects` / `components`) to match the
    catalog.
  - **Overview summary card**: the catalog Overview tab now shows a Cost
    Insights summary card at both the project and component levels,
    displaying the last-24-hour total cost (reusing the Total Cost card and,
    for a component, summed across its environments) with a "Go to Cost
    Insights" button that deep-links into the full view.
  - **Chart tooltips**: the stacked bar chart and the line chart tooltips now
    show the **Total** of the visible series and **highlight the row** for the
    segment/line under the pointer.
  - **Forecast clarity**: the "Forecast this month" summary card and the spend
    forecast chart gained an info tooltip explaining that the forecast projects
    the selected time window's rate across the month, so it can change with the
    chosen range and the amount of data available.

- 4389cde: Add a **Cost Insights** sidebar page that visualises the observer's
  per-environment FinOps (cost + right-sizing) data. The view is
  breadcrumb-scope driven (Namespace → Project → Component) with summary cards
  and a Table/Graph toggle at each level.

  - **Data layer**: `ObservabilityClient` gains `getCosts` /
    `getCostRecommendations` (resolving the observer URL per
    namespace+environment) plus `CostItem` / `CostRecommendationItem` types.
  - **Aggregation**: costs are fetched once per selected environment, plus one
    query over the previous equal-length window for deltas, then aggregated
    client-side — totals, cost-weighted efficiency, `% vs previous window`, and a
    current-month forecast by linear extrapolation. At the component level,
    right-sizing recommendations ("Cost After Optimizing") are attached
  - **UI**: breadcrumb scope switcher, environment multi-select, Table/Graph
    toggle, shared Time Range and graph-only granularity filters, summary cards, a
    sortable cost table (catalog-style column sorting, costs shown to 5 decimals
    so sub-cent values are visible), and a recharts stacked-bar graph over time.
    Wired into the portal sidebar and the `/cost-insights` route.

- c234b33: Add a **Delivery Insights** sidebar page showing the four DORA metrics, scoped
  by breadcrumb (Namespace → Project → Component). It sits alongside Cost
  Insights in the sidebar rather than on entity pages, since the audience is
  delivery leadership looking across an organisation rather than a developer
  working on one component.

  - **Metrics**: Deployment Frequency, Lead Time for Changes, Change Failure Rate
    and MTTR as KPI tiles with DORA classification, delta vs the previous equal
    window, and sparklines; a trend chart per metric at daily/weekly/monthly
    granularity (lead time shows p50/p75/p95).
  - **Drill-down**: a one-level-down breakdown table (namespace → projects,
    project → components, component → environments) sorted by deployment
    frequency, where each row carries its own metrics and an overall DORA rating
    (the scope's weakest tier). Project/component rows narrow the page scope;
    environment rows apply the environment filter.
  - **Per-environment cards** for the current scope, plus an environment filter
    and a "how these metrics are calculated" footnote.
  - **Bookmarkable views**: scope, range, granularity and environment all live in
    the URL, so a particular view can be shared or saved.
  - **Data layer**: `ObservabilityClient` gains `getDoraMetrics` /
    `getDoraDeployments` against the observer's
    `POST /api/v1alpha1/insights/dora/query` and
    `.../insights/dora/deployments/query`, called directly like the other
    observability APIs.
  - **URL resolution** gains namespace-level support: `/resolve-urls` now works
    without an `environmentName` by resolving through the namespace's
    environments (new `resolveForNamespace` in the client-node observability URL
    resolver), which is what the org-wide scope needs.
  - The namespace/project/component breadcrumb is now a shared `ScopeBreadcrumb`
    component used by both Delivery Insights and Cost Insights.

- 762b22a: Complete the New Frontend System migration for the portal shell and
  distribute scaffolder field extensions through the base plugin.

  **Portal**: `convertLegacyAppRoot` and `Root.tsx` are gone. Themes, icons,
  sidebar (`NavContentBlueprint`), provider stack, and every route now
  ship as NFS blueprints.

  **Adopter-facing additions**:

  - `@openchoreo/backstage-plugin/alpha` — `execTerminalPage`, 32
    `FormFieldBlueprint`s for OC template fields, plus new component
    exports (`ScaffolderPreselectionProvider`, `EntityWarningStrip`,
    `ForeignCardsSection`)
  - `@openchoreo/backstage-plugin-openchoreo-observability/alpha` —
    `costInsightsPage` with sidebar auto-discovery
  - `@openchoreo/backstage-plugin-platform-engineer-core/alpha` —
    `platformOverviewPage` with sidebar auto-discovery; `PlatformOverviewPage`
    source moved from portal-app
  - `@openchoreo/backstage-plugin-react` — `useQueryParams` (backwards-compat
    re-export left in `@openchoreo/backstage-plugin`)

### Patch Changes

- a958b80: Put the Delivery Insights page behind the `openchoreo.features.deliveryInsights`
  flag, off by default. It is a feature preview, and the page has nothing to show
  unless the Observer is separately configured to collect the data.
- 654b859: Fix the home page layout breaking on ~14" screens. The customizable widget grid
  defaulted `md` to 10 columns, which can't hold two width-6 cards, so the second
  card overlapped the first. `md` now uses 12 columns to keep the default cards
  side by side on wide screens, while smaller breakpoints stay narrow so the cards
  stack full-width.
- 6ccea2a: Add predefined home page card modules (not yet wired into the home page):

  - A home card registry + named layout configs (search, my-projects,
    quick-actions, recent-deployments, starred-entities, recently-visited,
    permission-gated platform-details) under `components/Home/cards`.
  - New `RecentDeploymentsCard` showing the latest releases across the user's
    components with per-environment status.
  - Shared `getRelativeTime` helper (also adopted by `RecentlyVisitedCard`).

  The current home page is unchanged; a follow-up will render it from the
  card registry.

- ce31a0e: Migrate entity pages to the Backstage New Frontend System. The hand-authored `EntityPage.tsx` in `packages/portal-app` (and its supporting files `EntityLayoutWithDelete.tsx`, `OpenChoreoCatalogEntityPage.tsx`, `WorkflowsOrExternalCICard.tsx`) is gone; tabs, cards, per-kind Overview layouts, and delete / annotation context menu items now ship as NFS blueprints from the plugins. Adopters installing `@openchoreo/backstage-plugin` in their own Backstage get the same OpenChoreo tabs and Overview grids as the portal automatically — no hand-authored `EntityPage.tsx` required.

  **New public exports from `@openchoreo/backstage-plugin`:**

  - `openChoreoEntityPageOverride` (from `/alpha`) — opt-in FrontendModule that swaps the canonical entity-page chrome for `OpenChoreoEntityLayout` (compact header + styled tab bar + delete / annotation menu items). Included by default in `@openchoreo/backstage-portal-app`. Adopters omit it to keep vanilla Backstage `<EntityLayout>` chrome — tabs and Overview layouts still work either way.
  - `OpenChoreoAboutCard`, `ContainedCatalogGraphCard`, `EntityRelationWarning` — previously portal-internal, now shipped as React components.

  **New NFS blueprints (all in `@openchoreo/backstage-plugin/alpha`):**

  - 18 `EntityContentLayoutBlueprint`s — one per OC-owned kind (Component, System, Domain, managed Resource, Environment, Dataplane / Cluster, WorkflowPlane / Cluster, ObservabilityPlane / Cluster, DeploymentPipeline, Component/Resource/Project/Trait Type families, Workflow / ClusterWorkflow, ComponentWorkflow). Each layout arranges bespoke OC cards in curated grid positions, then appends any adopter-contributed or upstream-default cards at the tail so third-party plugins compose visually.
  - 2 `EntityContextMenuItemBlueprint`s — permission-gated "Delete" and "Edit Annotations" actions. Both routes (canonical chrome + `openChoreoEntityPageOverride`) share the same presentational `DeleteEntityDialog` and `performEntityDelete` dispatch from PR #675.
  - `group` annotation on every `EntityContentBlueprint` (definition / deployment / runtime / analysis / external) for tab-ordering via `app.pages.entity.config`.
  - Upstream community CI plugins (`techdocs`, `jenkins`, `github-actions`, `gitlab`) registered so their annotation-gated tabs continue to appear on Component entities. The `api-docs/apis` and `techdocs` tabs are filter-tightened via app-side overrides so they only show when `providesApi`/`consumesApi` relations or `backstage.io/techdocs-ref` annotations are present (matching the pre-NFS `EntityPage.tsx` behavior).

  **Every OC blueprint is scoped to the `openchoreo.io/managed=true` label.** Two new helpers in `@openchoreo/backstage-plugin-common`: `isOpenChoreoManagedEntity` and `isOpenChoreoManagedOfKind(...kinds)`. Under NFS feature discovery, blueprints auto-attach — this label prevents OC UI leaking onto adopter entities of the same kind (Component, System, Domain, or any name that collides with an OC kind like `Environment`/`Workflow`) that aren't OC-owned.

  **Portal `app-config.yaml` and `app-config.production.yaml` add:**

  - `app.pages.entity.config.groups` — recommended tab ordering (overview / definition / deployment / runtime / analysis / external).
  - `app.extensions` — suppresses 20 upstream cards that duplicate OC layouts (`catalog/about`, `catalog/links`, `catalog/labels`, `catalog/depends-on-*`, `catalog/has-*`, `catalog-graph/relations`, `api-docs/*-apis`, `api-docs/providing-components`, `api-docs/consuming-components`, and 6 unconditional GitLab cards that throw when GitLab annotations are absent).

  See the README's Installation section for the recommended `app.pages.entity.config` block and per-extension override examples adopters can copy selectively.

- 9eb3d31: Register the Jenkins frontend plugin so the build-status card and tab work.
  `EntityLatestJenkinsRunCard` and `EntityJenkinsContent` are entity cards and
  tabs rather than routes, so `convertLegacyAppRoot` never discovered the plugin
  and `jenkinsApiRef` had no factory — the entity page threw
  `NotImplementedError: No implementation available for apiRef{plugin.jenkins.service2}`.
  Same fix already applied for api-docs and kubernetes.

  Also clarifies the scaffolder's CI identifier field: it takes a Jenkins job
  **full name** (`my-folder/my-job`), not a `/job/...` URL path. The plugin adds
  the `/job/` segments itself, so a URL-style value resolves to a folder literally
  named `job` and 404s.

- Updated dependencies [f39a20c]
- Updated dependencies [c142057]
- Updated dependencies [77c7a9c]
- Updated dependencies [f7fb9d2]
- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [67ba0da]
- Updated dependencies [526e7ac]
- Updated dependencies [6c8c373]
- Updated dependencies [202d582]
- Updated dependencies [d00d48b]
- Updated dependencies [093dabc]
- Updated dependencies [45caff4]
- Updated dependencies [4389cde]
- Updated dependencies [6648d25]
- Updated dependencies [c234b33]
- Updated dependencies [a958b80]
- Updated dependencies [2564efb]
- Updated dependencies [97be767]
- Updated dependencies [c2acee5]
- Updated dependencies [67ba0da]
- Updated dependencies [67ba0da]
- Updated dependencies [ce31a0e]
- Updated dependencies [762b22a]
- Updated dependencies [0a7d538]
- Updated dependencies [2803441]
- Updated dependencies [36f0982]
- Updated dependencies [d7f12e6]
- Updated dependencies [cc2fe12]
- Updated dependencies [23f804a]
- Updated dependencies [435463f]
- Updated dependencies [6729dc3]
- Updated dependencies [0c85b6b]
  - @openchoreo/backstage-design-system@1.3.0-next.0
  - @openchoreo/backstage-plugin-openchoreo-observability@1.3.0-next.0
  - @openchoreo/backstage-plugin-common@1.3.0-next.0
  - @openchoreo/backstage-plugin-react@1.3.0-next.0
  - @openchoreo/backstage-plugin@1.3.0-next.0
  - @openchoreo/backstage-plugin-openchoreo-ci@1.3.0-next.0
  - @openchoreo/backstage-plugin-openchoreo-workflows@1.3.0-next.0
  - @openchoreo/backstage-plugin-platform-engineer-core@1.3.0-next.0
  - @openchoreo/backstage-plugin-openchoreo-portal-assistant@1.3.0-next.0
