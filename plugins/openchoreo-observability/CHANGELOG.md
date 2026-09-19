# @openchoreo/backstage-plugin-openchoreo-observability

## 1.3.0

### Minor Changes

- c142057: Remove the `unauthenticated` outcome from the Audit Logs page: it is no longer offered as
  a result filter, and the event drawer no longer shows the token rejection notice. Requests
  rejected at authentication are recorded in the access log rather than the audit trail.
- f7fb9d2: Simplify the Audit Logs page: remove the outcome summary tiles, the events-over-time
  chart, the outcome color bar on table rows and the create/update/delete tags in front
  of each action. The table now fills the page to its bottom edge at any screen size,
  rather than using a fixed offset.
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

- 6c8c373: Expand the Cost Insights **Graphs** tab into a
  multi-chart dashboard rendered at every scope level:

  - **Spend forecast** – cumulative actual spend this month plus two month-end
    projections ("at current rate" and "if recommendations applied"), with a
    clickable legend to toggle each line. Independent of the chart granularity.
  - **Cost vs efficiency** – a scatter of each dimension (x: efficiency, y: cost,
    bubble size: potential saving) with a low-efficiency band, numbered bubbles,
    and a clickable numbered legend.
  - **Cost over time** – a per-dimension line chart and the existing stacked-bar
    chart; at the component level the bar chart overlays a dashed
    "if recommendations applied" line.

  The per-dimension saving and aggregate `totalSaving` are now computed at all
  levels (previously component-only), recommendations are fetched for the graphs
  view, and each chart carries an info tooltip describing what it shows.

- 202d582: Extend the component-level **Cost Insights** table to show right-sizing
  recommendations and apply them in one click.

  - **Recommendation table**: per-environment rows show the current cost (with
    cpu/memory breakdown), an efficiency bar, the recommended resource-request
    change (e.g. `cpu 100m → 12m`), the resulting saving (with percentage), and an
    **Apply** button.
  - **Apply action**: resolves the environment's ReleaseBinding, shows a
    confirm-diff dialog, and applies the recommended CPU/memory. Gated on the
    env-scoped `releasebinding:update` permission; the button is disabled when
    there is nothing to apply.
  - **Stale-recommendation guard**: recommendations are withheld (with an
    explanatory notice showing the spec update time) when the binding was updated
    after the selected window started, plus a 5-minute settling buffer, so
    pre-change usage can't produce misleading recommendations.
  - **Polish**: costs rounded to 2 decimals, more prominent summary-card values,
    gap-filling for missing graph buckets, and a full loader (no stale data) when
    the window/scope changes.

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

- 88cb693: Platform logs: cluster, namespace, pod, container and pod-label values in an expanded log row are now buttons that add the value to the active filters. List filters gain the value alongside what is already selected; a label is ANDed onto the selector, replacing any existing value for the same key.
- 0a7d538: Add a centralized Platform Logs dashboard for everything an observability plane
  collects — OpenChoreo's own system components included — as a Logs tab under
  Platform. It filters on raw Kubernetes
  coordinates — observability plane, cluster, namespace, pod, container, pod
  labels, level, time range and message search — so a platform engineer can reach
  any log the observability plane holds, including components OpenChoreo depends
  on but does not ship.

  A scope bar keeps the plane, time range, search, live tail and refresh visible;
  the coordinate pickers, labels and log levels fold away behind a Filters button
  and render as removable chips, so a collapsed row never hides what is narrowing
  the query. The cluster, namespace, pod and container pickers are multi-select
  and ask the observability plane for their values when opened, so they offer
  everything the current query matches rather than only what is on screen. They
  stay free text because that list is still bounded - by the time window, and by
  the values carrying the most records. The labels and
  search fields are validated as you type, so a half-typed label selector is
  explained on the field rather than sent and rejected. Expanding a row reveals
  the full message, the pod's coordinates and its labels.

  Every filter lives in the URL, so a filtered view is a shareable permalink.

  Adds the cluster-scoped `openchoreo.platformlogs.view` permission and a
  `usePlatformLogsPermission` hook for gating it. Unlike the component logs
  permission this one takes no entity, because platform logs are not owned by any
  project or component.

  The Platform section is assembled through Backstage's own sub-page mechanism
  rather than a shared shell component. `page:platform-engineer-core/platform-overview`
  is now a container page that renders whatever tabs are attached to its `pages`
  input, so any plugin can contribute a Platform tab with a `SubPageBlueprint`
  pointed at that id — no dependency on the platform-engineer-core package needed.
  The Logs tab is the first example, and ships as
  `sub-page:openchoreo-observability/platform-logs` (it was
  `page:openchoreo-observability/platform-logs`; that is the id to use when
  disabling or reconfiguring it under `app.extensions`).

  The section's chrome now comes from the portal's `core.page-layout` rather than a
  shell each tab mounted for itself, so the header and tab bar render once for the
  whole section instead of remounting on every tab switch. It looks the same: a
  tabbed page keeps the portal's standard `<Header>` rather than picking up
  Backstage's own toolbar, and switching tabs still carries the query string, so a
  round trip between tabs preserves the filters each had set. The only thing lost is
  the per-tab header subtitle.

  The Overview tab now lives at `/platform-overview/overview`; the bare
  `/platform-overview` still works and redirects there.

- 2803441: Populate the platform logs filter pickers from the observability plane rather than
  from the log lines on screen.

  Opening a picker now asks the plane which values that filter can take across every
  record matching the current query, rather than only those the loaded page happened to
  mention — so a pod that logged inside the time window is offered even when none of its
  lines are on the page yet, and picking a namespace no longer leaves the namespace
  picker showing that one value with no way back to the others. Each value carries how
  many records use it, and typing narrows the list at the plane rather than in the
  browser.

  The plane is asked one filter at a time, and only for the picker being opened: each
  answer costs it an aggregation, and a page view that never opens the filters costs
  nothing.

  A plane whose observer predates the endpoint, or whose logs module cannot aggregate,
  falls back to the previous behaviour — values derived from the loaded log lines — with
  no error, so the page behaves exactly as it did before against any existing
  deployment.

  The pickers, the label selector and the level select are no longer disabled while logs
  are loading. That froze them during a "load more", which with per-picker values would
  have blocked the very interaction that fetches them.

- 435463f: Apply RCA **Quick Fixes** that target a `ResourceReleaseBinding`.

  The panel previously sent every change to the Component `releasebindings`
  endpoint, so fixes the SRE agent raised against a Resource (e.g. a managed
  Postgres starved of memory) failed with `404`.

  - **Kind-aware routing**: each change is routed by the report's `target_kind`,
    with a missing value treated as `ReleaseBinding` so older reports keep working.
  - **New backend routes**: `GET|PUT /resource-release-binding`, forwarding the
    signed-in user's token so the API enforces `resourcereleasebinding:update`.
  - **Grouping**: patches group by binding kind _and_ name, so bindings of
    different kinds sharing a name are no longer merged into one GET/PUT.
  - **Scoped edits**: `ResourceReleaseBinding` changes are restricted to fields
    under `spec.resourceTypeEnvironmentConfigs`; env vars and file mounts stay
    exclusive to `ReleaseBinding`.
  - **Client**: RCA agent spec resynced from openchoreo `c0e6cd4c` to pick up the
    `target_kind` discriminator.

### Patch Changes

- 0133a8a: Audit logs: turning Live off now only stops polling. The records already fetched stay on screen instead of being cleared and reloaded.
- 77c7a9c: Use the shared full-page forbidden and disabled states on the Audit Logs page, with
  simpler messages that no longer name the required permission.
- a3e7d3f: Allow the API client to send a token over plain HTTP. Backstage reaches the
  OpenChoreo API over the in-cluster service URL, which is not TLS-terminated.

  A quick fix whose `target_kind` this portal version cannot route is now shown
  as unsupported instead of failing the Quick Fixes tab.

- 854df53: Fix "View report" in Cost Insights → Analysis Reports, which showed an empty Insights tab instead of the report. The tab's nested route now accepts the report id, the report link carries the query string that holds the selected project and environment, and the Analysis Reports tab stays selected while a report is open.
- 093dabc: Show a sub cent cost that rounds away at two decimals as `<0.01` rather than
  `0.00` across the Cost Insights view, so a very small cost reads apart from no
  cost at all. Also fix the cost vs efficiency chart dropping its tooltip when the
  pointer was over a bubble's rank label or over a small bubble.
- 6648d25: Add a review notice to the cost recommendation apply dialog.

  The **Cost Insights** apply recommendation dialog now explains that the values
  are derived from observed usage over the selected period and requests the user
  to verify before applying them

- 2564efb: Ship the OpenChoreo frontend integration surface out of the base plugin so
  adopters no longer copy-paste boilerplate into their `packages/app/`.
  `@openchoreo/backstage-plugin/alpha` now exports:

  - **`openChoreoAppModule`** — a `createFrontendModule({ pluginId: 'app' })`
    that wraps the app root in `OpenChoreoQueryProvider` and overrides
    `fetchApiRef` + `permissionApiRef` with the OpenChoreo IDP-token-aware
    implementations. Previously each adopter had to hand-copy the
    `OpenChoreoFetchApi` / `OpenChoreoPermissionApi` classes plus three
    `ApiBlueprint.make(...)` factories (~150 lines) into a local
    `customAppModule.tsx`.
  - **`openChoreoEntityGroupsModule`** — an opt-in
    `createFrontendModule({ pluginId: 'catalog' })` that overrides
    `page:catalog/entity`'s `groupDefinitions` with the canonical OpenChoreo
    tab order (Definition → Build → Deploy → Cell Diagram → …). Every OC tab
    uses a unique `group:` key so the vanilla NFS dropdown-collapse never
    triggers and tabs render flat. Non-OC entity pages are unaffected — the
    six upstream default group names are retained in their vanilla relative
    order.
  - **`openChoreoAuthApiRef`**, **`OpenChoreoFetchApi`**,
    **`OpenChoreoPermissionApi`** — surfaced as public exports so
    `customAppModule.tsx` can reference them without local re-declaration.
  - **`openchoreo:inject-user-token`** scaffolder form decorator — now
    registered automatically as a `FormDecoratorBlueprint` extension.
    Templates that opt in via `EXPERIMENTAL_formDecorators` in their spec get
    the signed-in user's IDP token injected as the `OPENCHOREO_USER_TOKEN`
    template secret with no adopter-side wiring.

  Group values on OpenChoreo entity content tabs were also uniqued across the
  three plugins (`deployment` → `deploy` / `build` / `cell-diagram` /
  `diagram`, `runtime` → `logs` / `events` / `metrics` / `alerts` /
  `wirelogs`, `analysis` → `traces` / `incidents` / `rca-reports` /
  `cost-analysis`). Combined with `openChoreoEntityGroupsModule` this
  guarantees flat tab rendering under vanilla NFS chrome.

  Portal-app is unchanged for users. Internally, the plugin-owned modules
  replace ~200 lines of previously-hand-copied wiring in
  `packages/portal-app/src/apis/customOverrides.tsx` and
  `packages/portal-app/src/appModule.tsx`, and the standalone
  `openChoreoTokenDecorator.ts` file in `packages/portal-app/src/scaffolder/`
  is deleted.

- 97be767: Remove the End Time column from the traces table and widen the Trace Name column.
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

- 23f804a: Render `<resource:name>` entity tags in RCA reports as catalog links, instead
  of dropping them as unknown HTML along with the resource name. Clamp resource
  parameter values to three lines, so a long value no longer stretches every
  card in the overview row.
- 6729dc3: Let the expanded panel of a log or event row be selected and copied. The
  expand/collapse handler covered the whole row, expanded panel included, so the
  `click` completing a drag-select collapsed the row and discarded the selection
  — the full message and every metadata value were impossible to copy.

  The handler now sits on the summary row only, leaving the expanded panel
  outside the click target. Clicking the summary row expands and collapses
  exactly as before.

- Updated dependencies [f39a20c]
- Updated dependencies [4c7f96c]
- Updated dependencies [67ba0da]
- Updated dependencies [526e7ac]
- Updated dependencies [202d582]
- Updated dependencies [d00d48b]
- Updated dependencies [45caff4]
- Updated dependencies [a958b80]
- Updated dependencies [2564efb]
- Updated dependencies [c2acee5]
- Updated dependencies [67ba0da]
- Updated dependencies [67ba0da]
- Updated dependencies [ce31a0e]
- Updated dependencies [762b22a]
- Updated dependencies [0a7d538]
- Updated dependencies [36f0982]
- Updated dependencies [d7f12e6]
- Updated dependencies [cc2fe12]
- Updated dependencies [23f804a]
- Updated dependencies [0c85b6b]
  - @openchoreo/backstage-design-system@1.3.0
  - @openchoreo/backstage-plugin-common@1.3.0
  - @openchoreo/backstage-plugin-react@1.3.0
  - @openchoreo/backstage-plugin@1.3.0

## 1.3.0-next.2

### Minor Changes

- 88cb693: Platform logs: cluster, namespace, pod, container and pod-label values in an expanded log row are now buttons that add the value to the active filters. List filters gain the value alongside what is already selected; a label is ANDed onto the selector, replacing any existing value for the same key.

### Patch Changes

- 0133a8a: Audit logs: turning Live off now only stops polling. The records already fetched stay on screen instead of being cleared and reloaded.
- 854df53: Fix "View report" in Cost Insights → Analysis Reports, which showed an empty Insights tab instead of the report. The tab's nested route now accepts the report id, the report link carries the query string that holds the selected project and environment, and the Analysis Reports tab stays selected while a report is open.

## 1.3.0-next.0

### Minor Changes

- c142057: Remove the `unauthenticated` outcome from the Audit Logs page: it is no longer offered as
  a result filter, and the event drawer no longer shows the token rejection notice. Requests
  rejected at authentication are recorded in the access log rather than the audit trail.
- f7fb9d2: Simplify the Audit Logs page: remove the outcome summary tiles, the events-over-time
  chart, the outcome color bar on table rows and the create/update/delete tags in front
  of each action. The table now fills the page to its bottom edge at any screen size,
  rather than using a fixed offset.
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

- 6c8c373: Expand the Cost Insights **Graphs** tab into a
  multi-chart dashboard rendered at every scope level:

  - **Spend forecast** – cumulative actual spend this month plus two month-end
    projections ("at current rate" and "if recommendations applied"), with a
    clickable legend to toggle each line. Independent of the chart granularity.
  - **Cost vs efficiency** – a scatter of each dimension (x: efficiency, y: cost,
    bubble size: potential saving) with a low-efficiency band, numbered bubbles,
    and a clickable numbered legend.
  - **Cost over time** – a per-dimension line chart and the existing stacked-bar
    chart; at the component level the bar chart overlays a dashed
    "if recommendations applied" line.

  The per-dimension saving and aggregate `totalSaving` are now computed at all
  levels (previously component-only), recommendations are fetched for the graphs
  view, and each chart carries an info tooltip describing what it shows.

- 202d582: Extend the component-level **Cost Insights** table to show right-sizing
  recommendations and apply them in one click.

  - **Recommendation table**: per-environment rows show the current cost (with
    cpu/memory breakdown), an efficiency bar, the recommended resource-request
    change (e.g. `cpu 100m → 12m`), the resulting saving (with percentage), and an
    **Apply** button.
  - **Apply action**: resolves the environment's ReleaseBinding, shows a
    confirm-diff dialog, and applies the recommended CPU/memory. Gated on the
    env-scoped `releasebinding:update` permission; the button is disabled when
    there is nothing to apply.
  - **Stale-recommendation guard**: recommendations are withheld (with an
    explanatory notice showing the spec update time) when the binding was updated
    after the selected window started, plus a 5-minute settling buffer, so
    pre-change usage can't produce misleading recommendations.
  - **Polish**: costs rounded to 2 decimals, more prominent summary-card values,
    gap-filling for missing graph buckets, and a full loader (no stale data) when
    the window/scope changes.

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

- 0a7d538: Add a centralized Platform Logs dashboard for everything an observability plane
  collects — OpenChoreo's own system components included — as a Logs tab under
  Platform. It filters on raw Kubernetes
  coordinates — observability plane, cluster, namespace, pod, container, pod
  labels, level, time range and message search — so a platform engineer can reach
  any log the observability plane holds, including components OpenChoreo depends
  on but does not ship.

  A scope bar keeps the plane, time range, search, live tail and refresh visible;
  the coordinate pickers, labels and log levels fold away behind a Filters button
  and render as removable chips, so a collapsed row never hides what is narrowing
  the query. The cluster, namespace, pod and container pickers are multi-select
  and ask the observability plane for their values when opened, so they offer
  everything the current query matches rather than only what is on screen. They
  stay free text because that list is still bounded - by the time window, and by
  the values carrying the most records. The labels and
  search fields are validated as you type, so a half-typed label selector is
  explained on the field rather than sent and rejected. Expanding a row reveals
  the full message, the pod's coordinates and its labels.

  Every filter lives in the URL, so a filtered view is a shareable permalink.

  Adds the cluster-scoped `openchoreo.platformlogs.view` permission and a
  `usePlatformLogsPermission` hook for gating it. Unlike the component logs
  permission this one takes no entity, because platform logs are not owned by any
  project or component.

  The Platform section is assembled through Backstage's own sub-page mechanism
  rather than a shared shell component. `page:platform-engineer-core/platform-overview`
  is now a container page that renders whatever tabs are attached to its `pages`
  input, so any plugin can contribute a Platform tab with a `SubPageBlueprint`
  pointed at that id — no dependency on the platform-engineer-core package needed.
  The Logs tab is the first example, and ships as
  `sub-page:openchoreo-observability/platform-logs` (it was
  `page:openchoreo-observability/platform-logs`; that is the id to use when
  disabling or reconfiguring it under `app.extensions`).

  The section's chrome now comes from the portal's `core.page-layout` rather than a
  shell each tab mounted for itself, so the header and tab bar render once for the
  whole section instead of remounting on every tab switch. It looks the same: a
  tabbed page keeps the portal's standard `<Header>` rather than picking up
  Backstage's own toolbar, and switching tabs still carries the query string, so a
  round trip between tabs preserves the filters each had set. The only thing lost is
  the per-tab header subtitle.

  The Overview tab now lives at `/platform-overview/overview`; the bare
  `/platform-overview` still works and redirects there.

- 2803441: Populate the platform logs filter pickers from the observability plane rather than
  from the log lines on screen.

  Opening a picker now asks the plane which values that filter can take across every
  record matching the current query, rather than only those the loaded page happened to
  mention — so a pod that logged inside the time window is offered even when none of its
  lines are on the page yet, and picking a namespace no longer leaves the namespace
  picker showing that one value with no way back to the others. Each value carries how
  many records use it, and typing narrows the list at the plane rather than in the
  browser.

  The plane is asked one filter at a time, and only for the picker being opened: each
  answer costs it an aggregation, and a page view that never opens the filters costs
  nothing.

  A plane whose observer predates the endpoint, or whose logs module cannot aggregate,
  falls back to the previous behaviour — values derived from the loaded log lines — with
  no error, so the page behaves exactly as it did before against any existing
  deployment.

  The pickers, the label selector and the level select are no longer disabled while logs
  are loading. That froze them during a "load more", which with per-picker values would
  have blocked the very interaction that fetches them.

- 435463f: Apply RCA **Quick Fixes** that target a `ResourceReleaseBinding`.

  The panel previously sent every change to the Component `releasebindings`
  endpoint, so fixes the SRE agent raised against a Resource (e.g. a managed
  Postgres starved of memory) failed with `404`.

  - **Kind-aware routing**: each change is routed by the report's `target_kind`,
    with a missing value treated as `ReleaseBinding` so older reports keep working.
  - **New backend routes**: `GET|PUT /resource-release-binding`, forwarding the
    signed-in user's token so the API enforces `resourcereleasebinding:update`.
  - **Grouping**: patches group by binding kind _and_ name, so bindings of
    different kinds sharing a name are no longer merged into one GET/PUT.
  - **Scoped edits**: `ResourceReleaseBinding` changes are restricted to fields
    under `spec.resourceTypeEnvironmentConfigs`; env vars and file mounts stay
    exclusive to `ReleaseBinding`.
  - **Client**: RCA agent spec resynced from openchoreo `c0e6cd4c` to pick up the
    `target_kind` discriminator.

### Patch Changes

- 77c7a9c: Use the shared full-page forbidden and disabled states on the Audit Logs page, with
  simpler messages that no longer name the required permission.
- a3e7d3f: Allow the API client to send a token over plain HTTP. Backstage reaches the
  OpenChoreo API over the in-cluster service URL, which is not TLS-terminated.

  A quick fix whose `target_kind` this portal version cannot route is now shown
  as unsupported instead of failing the Quick Fixes tab.

- 093dabc: Show a sub cent cost that rounds away at two decimals as `<0.01` rather than
  `0.00` across the Cost Insights view, so a very small cost reads apart from no
  cost at all. Also fix the cost vs efficiency chart dropping its tooltip when the
  pointer was over a bubble's rank label or over a small bubble.
- 6648d25: Add a review notice to the cost recommendation apply dialog.

  The **Cost Insights** apply recommendation dialog now explains that the values
  are derived from observed usage over the selected period and requests the user
  to verify before applying them

- 2564efb: Ship the OpenChoreo frontend integration surface out of the base plugin so
  adopters no longer copy-paste boilerplate into their `packages/app/`.
  `@openchoreo/backstage-plugin/alpha` now exports:

  - **`openChoreoAppModule`** — a `createFrontendModule({ pluginId: 'app' })`
    that wraps the app root in `OpenChoreoQueryProvider` and overrides
    `fetchApiRef` + `permissionApiRef` with the OpenChoreo IDP-token-aware
    implementations. Previously each adopter had to hand-copy the
    `OpenChoreoFetchApi` / `OpenChoreoPermissionApi` classes plus three
    `ApiBlueprint.make(...)` factories (~150 lines) into a local
    `customAppModule.tsx`.
  - **`openChoreoEntityGroupsModule`** — an opt-in
    `createFrontendModule({ pluginId: 'catalog' })` that overrides
    `page:catalog/entity`'s `groupDefinitions` with the canonical OpenChoreo
    tab order (Definition → Build → Deploy → Cell Diagram → …). Every OC tab
    uses a unique `group:` key so the vanilla NFS dropdown-collapse never
    triggers and tabs render flat. Non-OC entity pages are unaffected — the
    six upstream default group names are retained in their vanilla relative
    order.
  - **`openChoreoAuthApiRef`**, **`OpenChoreoFetchApi`**,
    **`OpenChoreoPermissionApi`** — surfaced as public exports so
    `customAppModule.tsx` can reference them without local re-declaration.
  - **`openchoreo:inject-user-token`** scaffolder form decorator — now
    registered automatically as a `FormDecoratorBlueprint` extension.
    Templates that opt in via `EXPERIMENTAL_formDecorators` in their spec get
    the signed-in user's IDP token injected as the `OPENCHOREO_USER_TOKEN`
    template secret with no adopter-side wiring.

  Group values on OpenChoreo entity content tabs were also uniqued across the
  three plugins (`deployment` → `deploy` / `build` / `cell-diagram` /
  `diagram`, `runtime` → `logs` / `events` / `metrics` / `alerts` /
  `wirelogs`, `analysis` → `traces` / `incidents` / `rca-reports` /
  `cost-analysis`). Combined with `openChoreoEntityGroupsModule` this
  guarantees flat tab rendering under vanilla NFS chrome.

  Portal-app is unchanged for users. Internally, the plugin-owned modules
  replace ~200 lines of previously-hand-copied wiring in
  `packages/portal-app/src/apis/customOverrides.tsx` and
  `packages/portal-app/src/appModule.tsx`, and the standalone
  `openChoreoTokenDecorator.ts` file in `packages/portal-app/src/scaffolder/`
  is deleted.

- 97be767: Remove the End Time column from the traces table and widen the Trace Name column.
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

- 23f804a: Render `<resource:name>` entity tags in RCA reports as catalog links, instead
  of dropping them as unknown HTML along with the resource name. Clamp resource
  parameter values to three lines, so a long value no longer stretches every
  card in the overview row.
- 6729dc3: Let the expanded panel of a log or event row be selected and copied. The
  expand/collapse handler covered the whole row, expanded panel included, so the
  `click` completing a drag-select collapsed the row and discarded the selection
  — the full message and every metadata value were impossible to copy.

  The handler now sits on the summary row only, leaving the expanded panel
  outside the click target. Clicking the summary row expands and collapses
  exactly as before.

- Updated dependencies [f39a20c]
- Updated dependencies [4c7f96c]
- Updated dependencies [67ba0da]
- Updated dependencies [526e7ac]
- Updated dependencies [202d582]
- Updated dependencies [d00d48b]
- Updated dependencies [45caff4]
- Updated dependencies [a958b80]
- Updated dependencies [2564efb]
- Updated dependencies [c2acee5]
- Updated dependencies [67ba0da]
- Updated dependencies [67ba0da]
- Updated dependencies [ce31a0e]
- Updated dependencies [762b22a]
- Updated dependencies [0a7d538]
- Updated dependencies [36f0982]
- Updated dependencies [d7f12e6]
- Updated dependencies [cc2fe12]
- Updated dependencies [23f804a]
- Updated dependencies [0c85b6b]
  - @openchoreo/backstage-design-system@1.3.0-next.0
  - @openchoreo/backstage-plugin-common@1.3.0-next.0
  - @openchoreo/backstage-plugin-react@1.3.0-next.0
  - @openchoreo/backstage-plugin@1.3.0-next.0

## 1.2.0

### Minor Changes

- 529f13c: add component events view and hooks
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

- 56b4e95: Adapt the tracing views to the OpenTelemetry span status model. The
  observability API now returns a span's `status` as a `SpanStatus` object
  (`code` of `ok`/`error`/`unset` plus an optional `message`) instead of a plain
  status string. The waterfall tooltip now shows the span's status code, the span
  details panel gains a dedicated Status section (alongside Attributes and Resource
  Attributes) that surfaces the status message, and error spans stay highlighted
  based on the status code. This also prevents the span tooltip from crashing when
  the status is an object.
- d89f030: Fix trace span details never loading from cache. The span cache key included
  the filter scope and time window, whose timestamps changed every render, so the
  key used to read spans (`getSpans`) no longer matched the one they were cached
  under and always returned `undefined`. Spans are now keyed by trace id alone —
  a trace id uniquely identifies its spans regardless of the query scope.
- 56b4e95: Fix the error stripe not rendering on error rows in the traces table. The red
  "contains errors" indicator was drawn by CSS targeting table cells (`td`/`th`)
  that no longer exist after the table moved to a div-based virtualized layout,
  and the span that did render (the tooltip's hover target) had no fill colour.
  The stripe is now drawn on the rendered element, so error traces show the red
  stripe again.
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

- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

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

- 5741d00: Limit how long a wirelogs stream can run. Wirelogs (Cilium Hubble flows) previously streamed indefinitely — there's no upstream timeout, so a forgotten tab could hold an open SSE connection for hours and degrade the browser.

  The backend `/wirelogs/stream` proxy now enforces a hard cap (default 15 minutes, configurable via `openchoreo.observability.wirelogs.streamTimeoutSeconds`): it advertises the cap to the client in a `meta` SSE frame and, on hitting it, sends a `timeout` frame before closing so the UI can label the stop precisely. The wirelogs view layers graduated soft warnings over this — confirmation dialogs at roughly one-third and two-thirds of the cap let the user stop early or knowingly continue, and a toast explains when the server ends the stream (the Start button resumes a fresh session).

- Updated dependencies [591df85]
- Updated dependencies [c86de7f]
- Updated dependencies [18e51cf]
- Updated dependencies [62608f5]
- Updated dependencies [529f13c]
- Updated dependencies [cf2203a]
- Updated dependencies [8381554]
- Updated dependencies [39d264c]
- Updated dependencies [0d2433f]
- Updated dependencies [8381554]
- Updated dependencies [b52e578]
- Updated dependencies [e3986a9]
- Updated dependencies [383e7f6]
- Updated dependencies [d5eff9e]
- Updated dependencies [4d7ebff]
- Updated dependencies [8416223]
- Updated dependencies [71f7b6c]
- Updated dependencies [2f45e83]
- Updated dependencies [14601f4]
- Updated dependencies [1207eda]
- Updated dependencies [7c76d05]
- Updated dependencies [591df85]
- Updated dependencies [915e2e5]
- Updated dependencies [284fcd7]
- Updated dependencies [453b958]
- Updated dependencies [c572a46]
- Updated dependencies [8d8bd80]
- Updated dependencies [d19ffcf]
  - @openchoreo/backstage-design-system@1.2.0
  - @openchoreo/backstage-plugin-react@1.2.0
  - @openchoreo/backstage-plugin-common@1.2.0

## 1.2.0-next.2

### Patch Changes

- 56b4e95: Adapt the tracing views to the OpenTelemetry span status model. The
  observability API now returns a span's `status` as a `SpanStatus` object
  (`code` of `ok`/`error`/`unset` plus an optional `message`) instead of a plain
  status string. The waterfall tooltip now shows the span's status code, the span
  details panel gains a dedicated Status section (alongside Attributes and Resource
  Attributes) that surfaces the status message, and error spans stay highlighted
  based on the status code. This also prevents the span tooltip from crashing when
  the status is an object.
- 56b4e95: Fix the error stripe not rendering on error rows in the traces table. The red
  "contains errors" indicator was drawn by CSS targeting table cells (`td`/`th`)
  that no longer exist after the table moved to a div-based virtualized layout,
  and the span that did render (the tooltip's hover target) had no fill colour.
  The stripe is now drawn on the rendered element, so error traces show the red
  stripe again.
- Updated dependencies [b52e578]
- Updated dependencies [4d7ebff]
  - @openchoreo/backstage-plugin-react@1.2.0-next.2
  - @openchoreo/backstage-plugin-common@1.2.0-next.2

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
