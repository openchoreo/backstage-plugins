# @openchoreo/openchoreo-client-node

## 1.4.0-m.1

### Minor Changes

- f5ca212: Notification channels read their secret values from SecretReferences. The create form picks
  SMTP credentials and webhook header secrets from the namespace's SecretReferences (those with no
  target plane or targeting an observability plane), with a key dropdown, instead of free-text
  Kubernetes Secret names. The channel's overview card shows its secret references with their keys,
  its Ready status, and a warning when it still copies values from Kubernetes Secrets, which is
  deprecated. The Secrets page can create secrets in an `ObservabilityPlane` or
  `ClusterObservabilityPlane` secret store, and the client is regenerated for the observability
  plane `secretStoreRef`, the new target plane kinds and the channel status conditions.
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

- c67978a: Replace Backstage CLI boilerplate in published package descriptions and READMEs with
  real ones, so the npm listings describe what each package does and point at the install
  guide. No code changes.

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

### Patch Changes

- a3e7d3f: Allow the API client to send a token over plain HTTP. Backstage reaches the
  OpenChoreo API over the in-cluster service URL, which is not TLS-terminated.

  A quick fix whose `target_kind` this portal version cannot route is now shown
  as unsupported instead of failing the Quick Fixes tab.

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

## 1.3.0-next.0

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

### Patch Changes

- a3e7d3f: Allow the API client to send a token over plain HTTP. Backstage reaches the
  OpenChoreo API over the in-cluster service URL, which is not TLS-terminated.

  A quick fix whose `target_kind` this portal version cannot route is now shown
  as unsupported instead of failing the Quick Fixes tab.

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

## 1.2.0

### Patch Changes

- 529f13c: add component events view and hooks
- 52396b0: Show container names in the resource-tree pod logs tab and add a per-container
  filter. The pod logs API now returns logs aggregated across all of a pod's
  containers, each entry tagged with its container. For multi-container pods
  (for example an app container plus a Dapr sidecar) the logs viewer aligns
  each line into timestamp / container / message columns and adds a container
  dropdown ("All containers" plus one entry per container) to filter the view.
  Single-container pods are unchanged.
- 2f45e83: Add Backstage catalog and UI support for the new OpenChoreo `ProjectType` (namespaced) and `ClusterProjectType` (cluster-scoped) platform-engineer abstractions introduced by the project-release-lifecycle epic.

  The catalog provider now ingests both kinds (full sync and near-real-time event deltas), translates them into dedicated entity kinds, and links each `Project` to the `ProjectType` / `ClusterProjectType` it references via `spec.type` (an `instanceOf` / `hasInstance` relation). Both kinds get first-class Overview pages — rendering their `parameters` / `environmentConfigs` schemas, `validations`, and `resources` templates — plus a Definition tab showing the raw CR, and they appear throughout the catalog UI (kind registry, icons, graph labels, About card).

  Permission wiring enables create / edit / delete on both kinds for authorized users, and a scaffolder creation wizard is added for each (grouped under "Platform Resources"). The generated OpenChoreo API client is re-synced from core `main` to pick up the `ProjectType` / `ClusterProjectType` schemas, their REST endpoints, and the new `Project.spec.type` field.

- 56b4e95: Adapt the tracing views to the OpenTelemetry span status model. The
  observability API now returns a span's `status` as a `SpanStatus` object
  (`code` of `ok`/`error`/`unset` plus an optional `message`) instead of a plain
  status string. The waterfall tooltip now shows the span's status code, the span
  details panel gains a dedicated Status section (alongside Attributes and Resource
  Attributes) that surfaces the status message, and error spans stay highlighted
  based on the status code. This also prevents the span tooltip from crashing when
  the status is an object.
- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

## 1.2.0-next.2

### Patch Changes

- 52396b0: Show container names in the resource-tree pod logs tab and add a per-container
  filter. The pod logs API now returns logs aggregated across all of a pod's
  containers, each entry tagged with its container. For multi-container pods
  (for example an app container plus a Dapr sidecar) the logs viewer aligns
  each line into timestamp / container / message columns and adds a container
  dropdown ("All containers" plus one entry per container) to filter the view.
  Single-container pods are unchanged.
- 56b4e95: Adapt the tracing views to the OpenTelemetry span status model. The
  observability API now returns a span's `status` as a `SpanStatus` object
  (`code` of `ok`/`error`/`unset` plus an optional `message`) instead of a plain
  status string. The waterfall tooltip now shows the span's status code, the span
  details panel gains a dedicated Status section (alongside Attributes and Resource
  Attributes) that surfaces the status message, and error spans stay highlighted
  based on the status code. This also prevents the span tooltip from crashing when
  the status is an object.

## 1.2.0-next.3

### Patch Changes

- 2f45e83: Add Backstage catalog and UI support for the new OpenChoreo `ProjectType` (namespaced) and `ClusterProjectType` (cluster-scoped) platform-engineer abstractions introduced by the project-release-lifecycle epic.

  The catalog provider now ingests both kinds (full sync and near-real-time event deltas), translates them into dedicated entity kinds, and links each `Project` to the `ProjectType` / `ClusterProjectType` it references via `spec.type` (an `instanceOf` / `hasInstance` relation). Both kinds get first-class Overview pages — rendering their `parameters` / `environmentConfigs` schemas, `validations`, and `resources` templates — plus a Definition tab showing the raw CR, and they appear throughout the catalog UI (kind registry, icons, graph labels, About card).

  Permission wiring enables create / edit / delete on both kinds for authorized users, and a scaffolder creation wizard is added for each (grouped under "Platform Resources"). The generated OpenChoreo API client is re-synced from core `main` to pick up the `ProjectType` / `ClusterProjectType` schemas, their REST endpoints, and the new `Project.spec.type` field.

## 1.2.0-next.0

### Patch Changes

- 529f13c: add component events view and hooks
- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

## 1.1.1

- Compatible release for OpenChoreo 1.1.1.

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
