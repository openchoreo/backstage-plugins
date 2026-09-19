# @openchoreo/backstage-plugin-common

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

### Patch Changes

- a958b80: Put the Delivery Insights page behind the `openchoreo.features.deliveryInsights`
  flag, off by default. It is a feature preview, and the page has nothing to show
  unless the Observer is separately configured to collect the data.
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

- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [c234b33]
- Updated dependencies [435463f]
  - @openchoreo/openchoreo-client-node@1.3.0

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

### Patch Changes

- a958b80: Put the Delivery Insights page behind the `openchoreo.features.deliveryInsights`
  flag, off by default. It is a feature preview, and the page has nothing to show
  unless the Observer is separately configured to collect the data.
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

- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [c234b33]
- Updated dependencies [435463f]
  - @openchoreo/openchoreo-client-node@1.3.0-next.0

## 1.2.0

### Minor Changes

- 18e51cf: Add support for custom component-creation templates. A (Cluster)ComponentType
  can now set the `scaffolder.openchoreo.dev/backstage-template-url` annotation to
  point at a hand-authored Backstage scaffolder Template. When present, the catalog
  sync fetches that Template from the URL (via the configured `integrations`) and
  emits it in place of the auto-generated wizard; when absent, behaviour is
  unchanged. Applies to both the periodic and event-driven sync paths. If the URL
  cannot be read or does not yield a valid `kind: Template`, an error is logged and
  no template is emitted for that type.
- cf2203a: Add a pod-aware exec terminal in the Deploy view. The Terminal lives in the K8s resource-tree drawer reached via Deploy → environment → View K8s Artifacts: it appears as a tab on the Pod node's drawer (with a container picker) when the pod is rendered in the tree, and falls back to the ReleaseBinding drawer when the pod is managed by another operator and the binding is healthy. The exec session targets the selected pod and container via WebSocket. The standalone component-level Terminal tab has been removed.

  Access is gated by the `openchoreo.exec` permission with per-environment ABAC, and the `POST /exec/init` backend endpoint now enforces this permission server-side so direct API calls cannot bypass the UI gate.

- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 284fcd7: Surface OpenChoreo controller auto-deploy failures in the Deploy tab. Pre-binding release-generation failures (bad trait, invalid config — from `Component.status.conditions`) now surface on the Setup card and as an error marker on the canvas Set-up tile, instead of leaving the user with no signal. Post-binding render/apply failures (from `ReleaseBinding.status.conditions`) show an actionable error banner with the controller's reason + message in the environment detail panel, instead of a context-free "Failed" badge. Long controller messages are clamped to a compact banner with a "View details" dialog (reason + full message + copy).

### Patch Changes

- 62608f5: chore: remove dead code left over from the OpenAPI-client and New Frontend
  System migrations — commented-out blocks, orphaned files/components, and unused
  deprecated exports (`LogEntry`/`RuntimeLogsResponse` aliases, `FILTER_PRESETS`,
  `useOrgName`, `useRCAReportByAlert`, `UserTypeConfig`), plus consolidation of
  duplicated backend response-type wrappers. No behavioural changes.
- 529f13c: add component events view and hooks
- 39d264c: Fix OAuth scopes in the auth code flow: inject configured scope into the passport-oauth2 token exchange and refresh, and expose the scope to the frontend client via `openchoreo.features.auth.scope` so sign-in and session refresh requests use the operator-configured scope instead of hardcoded defaults.
- 8416223: Add a per-ProjectType "Create Project" wizard, mirroring the Resource creation flow.

  Each `ProjectType` / `ClusterProjectType` now generates a scaffolder Template via `PtdToTemplateConverter`, surfaced under a new `?view=projects` browse view with a dedicated "Project" landing card. Selecting a type opens a wizard whose parameters step is driven by the type's `spec.parameters.openAPIV3Schema`, then creates the Project with `spec.type` and `spec.parameters` set via the extended `openchoreo:project:create` action (it falls back to the OpenChoreo API default when these are omitted, keeping the legacy path working). The catalog provider emits these templates during full sync and the event-delta path keeps them current. Replaces the static `create-openchoreo-project` template.

- 71f7b6c: Add a "Deploy" tab to the Project entity page for the project-release lifecycle.

  The tab renders the project's deployment pipeline as a DAG of environments with live status and drives deploy/promote through `ProjectRelease` / `ProjectReleaseBinding`. A "Set up" card opens a **Configure & Deploy** wizard: step 1 edits `Project.spec.parameters` against the `(Cluster)ProjectType` parameters schema (saving cuts a new `ProjectRelease`), step 2 pins the first environment's binding and edits its `environmentConfigs` overrides. Each environment node supports **Promote** (copy the pinned release forward to the next environment) and **Configure overrides**; all mutating actions gate on the project-update permission.

  Backed by new BFF endpoints (`/project-environment-info`, `/project-release-bindings`, `/update-project-release-binding`, `/project-release-schema`) and matching `OpenChoreoClient` methods.

- 2f45e83: Add Backstage catalog and UI support for the new OpenChoreo `ProjectType` (namespaced) and `ClusterProjectType` (cluster-scoped) platform-engineer abstractions introduced by the project-release-lifecycle epic.

  The catalog provider now ingests both kinds (full sync and near-real-time event deltas), translates them into dedicated entity kinds, and links each `Project` to the `ProjectType` / `ClusterProjectType` it references via `spec.type` (an `instanceOf` / `hasInstance` relation). Both kinds get first-class Overview pages — rendering their `parameters` / `environmentConfigs` schemas, `validations`, and `resources` templates — plus a Definition tab showing the raw CR, and they appear throughout the catalog UI (kind registry, icons, graph labels, About card).

  Permission wiring enables create / edit / delete on both kinds for authorized users, and a scaffolder creation wizard is added for each (grouped under "Platform Resources"). The generated OpenChoreo API client is re-synced from core `main` to pick up the `ProjectType` / `ClusterProjectType` schemas, their REST endpoints, and the new `Project.spec.type` field.

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

- Updated dependencies [529f13c]
- Updated dependencies [52396b0]
- Updated dependencies [2f45e83]
- Updated dependencies [56b4e95]
- Updated dependencies [8d8bd80]
  - @openchoreo/openchoreo-client-node@1.2.0

## 1.2.0-next.2

### Patch Changes

- Updated dependencies [52396b0]
- Updated dependencies [56b4e95]
  - @openchoreo/openchoreo-client-node@1.2.0-next.2

## 1.2.0-next.3

### Minor Changes

- 18e51cf: Add support for custom component-creation templates. A (Cluster)ComponentType
  can now set the `scaffolder.openchoreo.dev/backstage-template-url` annotation to
  point at a hand-authored Backstage scaffolder Template. When present, the catalog
  sync fetches that Template from the URL (via the configured `integrations`) and
  emits it in place of the auto-generated wizard; when absent, behaviour is
  unchanged. Applies to both the periodic and event-driven sync paths. If the URL
  cannot be read or does not yield a valid `kind: Template`, an error is logged and
  no template is emitted for that type.
- cf2203a: Add a pod-aware exec terminal in the Deploy view. The Terminal lives in the K8s resource-tree drawer reached via Deploy → environment → View K8s Artifacts: it appears as a tab on the Pod node's drawer (with a container picker) when the pod is rendered in the tree, and falls back to the ReleaseBinding drawer when the pod is managed by another operator and the binding is healthy. The exec session targets the selected pod and container via WebSocket. The standalone component-level Terminal tab has been removed.

  Access is gated by the `openchoreo.exec` permission with per-environment ABAC, and the `POST /exec/init` backend endpoint now enforces this permission server-side so direct API calls cannot bypass the UI gate.

- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 284fcd7: Surface OpenChoreo controller auto-deploy failures in the Deploy tab. Pre-binding release-generation failures (bad trait, invalid config — from `Component.status.conditions`) now surface on the Setup card and as an error marker on the canvas Set-up tile, instead of leaving the user with no signal. Post-binding render/apply failures (from `ReleaseBinding.status.conditions`) show an actionable error banner with the controller's reason + message in the environment detail panel, instead of a context-free "Failed" badge. Long controller messages are clamped to a compact banner with a "View details" dialog (reason + full message + copy).

### Patch Changes

- 62608f5: chore: remove dead code left over from the OpenAPI-client and New Frontend
  System migrations — commented-out blocks, orphaned files/components, and unused
  deprecated exports (`LogEntry`/`RuntimeLogsResponse` aliases, `FILTER_PRESETS`,
  `useOrgName`, `useRCAReportByAlert`, `UserTypeConfig`), plus consolidation of
  duplicated backend response-type wrappers. No behavioural changes.
- 39d264c: Fix OAuth scopes in the auth code flow: inject configured scope into the passport-oauth2 token exchange and refresh, and expose the scope to the frontend client via `openchoreo.features.auth.scope` so sign-in and session refresh requests use the operator-configured scope instead of hardcoded defaults.
- 8416223: Add a per-ProjectType "Create Project" wizard, mirroring the Resource creation flow.

  Each `ProjectType` / `ClusterProjectType` now generates a scaffolder Template via `PtdToTemplateConverter`, surfaced under a new `?view=projects` browse view with a dedicated "Project" landing card. Selecting a type opens a wizard whose parameters step is driven by the type's `spec.parameters.openAPIV3Schema`, then creates the Project with `spec.type` and `spec.parameters` set via the extended `openchoreo:project:create` action (it falls back to the OpenChoreo API default when these are omitted, keeping the legacy path working). The catalog provider emits these templates during full sync and the event-delta path keeps them current. Replaces the static `create-openchoreo-project` template.

- 71f7b6c: Add a "Deploy" tab to the Project entity page for the project-release lifecycle.

  The tab renders the project's deployment pipeline as a DAG of environments with live status and drives deploy/promote through `ProjectRelease` / `ProjectReleaseBinding`. A "Set up" card opens a **Configure & Deploy** wizard: step 1 edits `Project.spec.parameters` against the `(Cluster)ProjectType` parameters schema (saving cuts a new `ProjectRelease`), step 2 pins the first environment's binding and edits its `environmentConfigs` overrides. Each environment node supports **Promote** (copy the pinned release forward to the next environment) and **Configure overrides**; all mutating actions gate on the project-update permission.

  Backed by new BFF endpoints (`/project-environment-info`, `/project-release-bindings`, `/update-project-release-binding`, `/project-release-schema`) and matching `OpenChoreoClient` methods.

- 2f45e83: Add Backstage catalog and UI support for the new OpenChoreo `ProjectType` (namespaced) and `ClusterProjectType` (cluster-scoped) platform-engineer abstractions introduced by the project-release-lifecycle epic.

  The catalog provider now ingests both kinds (full sync and near-real-time event deltas), translates them into dedicated entity kinds, and links each `Project` to the `ProjectType` / `ClusterProjectType` it references via `spec.type` (an `instanceOf` / `hasInstance` relation). Both kinds get first-class Overview pages — rendering their `parameters` / `environmentConfigs` schemas, `validations`, and `resources` templates — plus a Definition tab showing the raw CR, and they appear throughout the catalog UI (kind registry, icons, graph labels, About card).

  Permission wiring enables create / edit / delete on both kinds for authorized users, and a scaffolder creation wizard is added for each (grouped under "Platform Resources"). The generated OpenChoreo API client is re-synced from core `main` to pick up the `ProjectType` / `ClusterProjectType` schemas, their REST endpoints, and the new `Project.spec.type` field.

- Updated dependencies [2f45e83]
  - @openchoreo/openchoreo-client-node@1.2.0-next.3

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

- Updated dependencies [529f13c]
- Updated dependencies [8d8bd80]
  - @openchoreo/openchoreo-client-node@1.2.0-next.0

## 1.1.1

- Compatible release for OpenChoreo 1.1.1.

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
