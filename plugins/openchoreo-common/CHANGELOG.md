# @openchoreo/backstage-plugin-common

## 1.4.0-m.3

### Minor Changes

- 6268316: Expose a component's endpoints through Endpoints, from its configure page.

  Component creation no longer asks for endpoints: the creation form drops its
  Endpoints section, the scaffolder creates the workload without endpoints, and
  the legacy `port` parameter no longer adds an `http` endpoint. A component's
  endpoints are defined on its configure page after creation.

  The component's ComponentType decides what the configure page's Endpoints tab
  shows. Before upgrading, platform engineers annotate every
  (Cluster)ComponentType that predates Endpoints with
  `openchoreo.dev/legacy-endpoints: "true"`.

  - An annotated type gets the legacy form: the workload endpoint editor, with
    visibility on the workload (deprecated), served by the type's own templated
    routes. No Endpoints are created.
  - A type with `allowedEndpoints` gets the Endpoints form: one card per
    endpoint. **Add Endpoint** first shows a card for each Endpoint type in
    `allowedEndpoints`, with its title, description and protocols from the
    catalog. Picking one opens the endpoint's form under that type's name and
    description, with its name, protocol (limited to those the type serves),
    port, visibility, schema and the type's parameters, in two halves split by
    a line: the endpoint's own fields on the left and the type's parameters on
    the right, which scroll within the left half's height. Project is a visibility like the others: the
    Endpoint carries every visibility chosen, project included, so an endpoint
    with only Project ticked gets an Endpoint with `project` visibility (this
    needs an openchoreo that accepts it). Saving creates the Endpoint and
    drops the visibility from the workload.
    Workload endpoints without an Endpoint stay within the project, and those
    from before Endpoints, which carry visibility beyond project but have no
    Endpoint, get no card and stay on the workload as they are.
  - A type with neither shows no form, and saving changes no Endpoints.

  In YAML mode the configure page has a tab for the Workload and one for each
  of the component's Endpoints, existing or to be created, showing the Endpoint
  as saving will leave it. An existing Endpoint's tab edits its
  `spec.visibility` and `spec.parameters`; one to be created can also change its
  `spec.type` and the workload endpoint its backend routes to. **Add Endpoint**
  opens a new Endpoint's YAML: write it, add the workload endpoint it routes to
  in the Workload tab, and it joins the page's changes. Saving waits until every
  new Endpoint is complete. A tab's ✕ removes the Endpoint and leaves its
  workload endpoint within the project.

  A card with an Endpoint shows its name, Ready state, type and parameters. It can
  be edited or deleted, and changes are staged with the workload and saved after
  it. A renamed workload endpoint keeps its Endpoints; one that's removed has
  its Endpoints deleted on save. Renaming a new endpoint before saving it no
  longer leaves an `endpoint-<n>` row behind, in either form. The endpoint
  editor's Type field is now Protocol.

  The component owns the Endpoints created here (`spec.owner.componentName`), so
  deleting the component deletes them. A release line's configure page manages
  the line's own Endpoints (`spec.owner.releaseLineName`) and offers the main
  line's Endpoints as drafts to review and save for the line. When a backend
  added elsewhere routes outside the owner, the API widens the owner, and the
  Endpoint leaves the configure page.

  The backend adds `/component-endpoints` (GET, POST, PUT, DELETE), which only
  touches Endpoints the component's line owns and returns the ComponentType's
  `allowedEndpoints` and legacy annotation, `/release-line-endpoint-drafts`,
  and `/endpoint-type-schema` and `/cluster-endpoint-type-schema` for the
  parameters form. Naming and building these Endpoints, and choosing their
  EndpointType, live in `@openchoreo/backstage-plugin-common`.

  Project contents no longer list Endpoints a component owns. Catalog Endpoint
  entities carry an `openchoreo.io/endpoint-scope` label, `component` or
  `project`, so views can filter on it.

- 86d3c99: Manage an Endpoint's backends and see its URLs on its Deploy tab.

  The Set up pane on the Deploy tab lists the Endpoint's backends with the share
  of traffic each receives, and adds, reweights and removes them:

  - any workload endpoint in the project can be added;
  - an Endpoint takes 1 to 16 backends, weights are whole numbers from 0 to
    1,000,000, and at least one backend must take traffic;
  - adding a backend on another component to a component-owned Endpoint moves
    the Endpoint to its project, and the dialog says so first;
  - changes need the `openchoreo.endpoint.update` permission.

  Each change cuts a new release, which the pane offers to deploy. The Overview's
  Routing card is read-only. The backend adds `POST`, `PATCH` and `DELETE
/endpoint-backends`.

  Each environment on the Deploy tab lists the URLs the Endpoint is invoked at
  there, per visibility, with the security a caller must present. Its last deploy
  time comes from the binding's `lastSpecUpdateTime`, so it moves on every
  deploy. Refreshing an entity no longer swaps its page for a spinner, so open
  panes stay open.

  Endpoint entities carry their owning component in the
  `openchoreo.io/endpoint-owner-component` annotation.

  The OpenChoreo API client is synced to openchoreo `main`. Workload endpoints
  have a `protocol` field, and the deprecated `type` is optional; read them
  through the new `endpointProtocol()` helper.

- bff9b10: Add backend routes and client methods for working with Endpoints:

  - `endpoint-environment-info` lists every environment in the project's
    deployment pipeline with the release pinned there, its status, and how each
    backend resolved, including why one did not.
  - `update-endpoint-release-binding` deploys, promotes or saves per-environment
    overrides, and `delete-endpoint-release-binding` undeploys. Both find the
    binding for an environment by its owner and environment, so bindings created
    outside the portal are handled too. Saving overrides keeps the release
    pinned there. A new binding needs a release and is named
    `<endpoint>-<environment>`.
  - `endpoint-release` reads a release snapshot, and `endpoint-release-schema`
    reads the environmentConfigs schema frozen on it.

  The definition editor now supports Endpoints, EndpointTypes and
  ClusterEndpointTypes.

- bff9b10: Ingest OpenChoreo Endpoints into the catalog. Endpoints, EndpointTypes and
  ClusterEndpointTypes become catalog entities, kept current by the periodic sync
  and by `endpoint`, `endpointtype` and `clusterendpointtype` events.

  An Endpoint entity belongs to its project, is an instance of its
  (Cluster)EndpointType, and has a `routesTo` relation to each Component it sends
  traffic to (`routedBy` on the Component). When the Endpoint declares a schema,
  an API entity named `endpoint-<endpoint name>` carries it, and the Endpoint
  `providesApi` that entity. Endpoints without a schema get no API entity, and the
  API entities already created for workload endpoints are unchanged.

  Catalog visibility follows the OpenChoreo `endpoint:view`, `endpointtype:view`
  and `clusterendpointtype:view` actions. Endpoints are scoped at project level,
  like Resources. The catalog lists the new kinds with their own names and icons.

  The OpenChoreo API client is regenerated against an API spec that includes the
  Endpoint family.

- be71fce: Create Endpoints from a project. The project's Create button has a Create
  Endpoint option, which opens a new Endpoints view on the create page. That view
  lists one generated template per (Cluster)EndpointType, kept in sync with the
  types by the catalog.

  The wizard asks for:

  - the Endpoint's name;
  - the scopes it is exposed to;
  - its backends, at most 16: components of the project, each with one of its
    workload endpoints and a relative weight;
  - the type's parameters.

  The wizard can also add an API schema to the Endpoint. It is optional and off by
  default; turned on, it starts from the first backend's workload endpoint schema
  and can be edited. The new `openchoreo:endpoint:create` action
  creates the Endpoint and adds it, with the API entity for its schema, to the
  catalog straight away.

  An Endpoint's API entity is named `endpoint-<name>`. When that would exceed the
  catalog's 63-character limit, the name is cut and suffixed with a hash of the
  Endpoint name, so long Endpoint names still get their API entity.

  Creating Endpoints is gated by the new `openchoreo.endpoint.create` permission.

- bff9b10: Add a Deploy tab to Endpoint entities. It shows the project's deployment
  pipeline with each environment's status, the release pinned there, and
  whether it is behind the environment before it. From the tab you can:

  - deploy the Endpoint's latest release to the first environment from Set up,
    and promote it forward;
  - see how each backend resolved in an environment: its in-cluster address, or
    why it did not resolve;
  - edit per-environment overrides against the pinned release's schema;
  - view the release manifest, or remove the deployment from an environment.

  These actions are gated by new `openchoreo.endpointreleasebinding.create`,
  `.update` and `.delete` permissions, scoped per environment.

  The pipeline canvas and release manifest dialog are now shared between the
  Resource and Endpoint Deploy tabs.

- bff9b10: Add an Endpoint entity page. Its Overview shows:

  - **Routing:** the (Cluster)EndpointType that renders it, the scopes it is
    exposed to, and each backend component with its share of traffic.
  - **Deployments:** the status in each environment, with a link to the Deploy
    tab.
  - **API:** a link to the API entity carrying its schema, when it has one.

  The Definition tab and the delete action now cover Endpoints, EndpointTypes
  and ClusterEndpointTypes, gated by new `openchoreo.endpoint.*`,
  `openchoreo.endpointtype.*` and `openchoreo.clusterendpointtype.*` update and
  delete permissions. The Developer Resources graph view includes Endpoints and
  the components they route to.

- 8aa6389: Route an Endpoint's traffic to a component's release lines, for a canary.

  The Add backend dialog on an Endpoint's Set up pane offers the workload
  endpoints of each component's release lines next to its main line's, labelled
  `component @ line / endpoint`. A backend on a release line is named
  `<component>-<line>-<endpoint>`, and `POST /endpoint-backends` takes an
  optional `releaseLine`. The backend lists on the Set up pane and the Overview
  show each backend's line.

  When a release line owns an Endpoint, the dialog warns that a backend on
  another line moves the Endpoint to its component, and one on another component
  moves it to the project.

  Endpoint entities keep each backend's `releaseLine`, and carry the owning line
  in the `openchoreo.io/endpoint-owner-release-line` annotation.

  The OpenChoreo API client is synced to openchoreo `main`, which adds
  `backendRefs[].component.releaseLine` and `spec.owner.releaseLineName` to
  Endpoints.

- 6268316: Deploy and promote a component's Endpoints with the component.

  When a component, or one of its release lines, is deployed to, promoted to
  or removed from an environment, the Endpoints that line owns follow it in the
  same step. Project-owned Endpoints, and those of other lines, are left alone.

  - **Deploy:** each Endpoint is bound to its latest release in the
    environment. Endpoints with `autoDeploy` are left to the controller, which
    already keeps them on their latest release there.
  - **Promote:** each Endpoint gets the release its binding pins in the source
    environment, so the same Endpoint version moves with the component. Every
    Endpoint is bound, whatever its `autoDeploy`. If any of them isn't deployed
    in the source environment, the promotion is rejected (409) before anything
    changes, with a message naming them.
  - **Suspend, undeploy and redeploy:** only the component's binding changes.
    The Endpoints' bindings stay, with their release and environment settings;
    an Endpoint is managed from its own Deploy tab.
  - **Remove:** once the component's deployment is found, the Endpoints'
    bindings in that environment are deleted, then the component's, so their
    routes don't point at a workload that's gone.

  An existing binding keeps its environment overrides; only its release
  changes. An Endpoint created just before a deploy gets a few seconds to have
  its first release cut. An Endpoint that can't follow never undoes the
  component's change: the result names it and why, and points at the
  Endpoint's Deploy tab to put it right.

  The backend's `PUT /update-release-binding` takes an optional
  `sourceEnvironment` (a promotion) and adds an `endpoints` result to its
  response. `DELETE /delete-release-binding` now responds with
  `{ environments, endpoints }`. The rules are
  `planEndpointFollow` in `@openchoreo/backstage-plugin-common`.

- 02c5a87: Synced Components hosted on GitHub or GitLab now carry
  `backstage.io/source-location` in the form Backstage itself writes,
  `url:<repo>/tree/<branch>/<appPath>/` (`/-/tree/` on GitLab), instead of the
  bare repository URL. The trailing `/` marks it as a folder, which Backstage
  needs to resolve relative paths against it. Tools that read the standard
  annotation (the "View source" link, Tech Insights fact retrievers) get the
  branch and the component's folder without an OpenChoreo-specific annotation.
  Other hosts, such as Bitbucket and Azure DevOps, lay out these URLs
  differently and keep the repository URL. `openchoreo.io/branch` is still
  written, because a branch name containing `/` can't be told apart from the
  folder after it in a URL.

  `getRepositoryUrl()` changes to match:

  - it no longer assumes `main` when the branch is unknown, and returns the
    repository URL instead;
  - with a branch but no app path it returns `<repo>/tree/<branch>` rather than
    the bare repository URL;
  - it returns the repository URL for hosts other than GitHub and GitLab, which
    it recognises by `github.com`, `gitlab.com` or a host whose first label is
    `github` or `gitlab`;
  - it strips a trailing `.git` from the repository URL and a leading `./` or
    `/` from the app path.

### Patch Changes

- Updated dependencies [86d3c99]
- Updated dependencies [bff9b10]
- Updated dependencies [8aa6389]
- Updated dependencies [bcbd114]
- Updated dependencies [6ac94f5]
- Updated dependencies [6268316]
  - @openchoreo/openchoreo-client-node@2.0.0-next.3

## 2.0.0-next.2

### Patch Changes

- Updated dependencies [1cec15b]
  - @openchoreo/openchoreo-client-node@2.0.0-next.2

## 1.4.0-m.1

### Minor Changes

- 9e3a840: Put Cost Insights behind the `openchoreo.features.costInsights` feature flag,
  alongside the existing OpenChoreo feature flags. Opt-in: it defaults to false.
- f5ca212: Notification channels read their secret values from SecretReferences. The create form picks
  SMTP credentials and webhook header secrets from the namespace's SecretReferences (those with no
  target plane or targeting an observability plane), with a key dropdown, instead of free-text
  Kubernetes Secret names. The channel's overview card shows its secret references with their keys,
  its Ready status, and a warning when it still copies values from Kubernetes Secrets, which is
  deprecated. The Secrets page can create secrets in an `ObservabilityPlane` or
  `ClusterObservabilityPlane` secret store, and the client is regenerated for the observability
  plane `secretStoreRef`, the new target plane kinds and the channel status conditions.
- 44795b9: Stop overriding the app-wide fetch API and attach the OpenChoreo user token to
  OpenChoreo requests only.

  `openChoreoAppModule` registered an `api:app/core.fetch` override. In the
  portal that was invisible, but in any other Backstage host it replaced the
  app's own fetch API for every installed plugin — dropping the default
  middleware chain (`plugin://` resolution, failure clarification, and identity
  injection scoped to the host's own `backend.baseUrl`) and attaching both the
  Backstage token and the OpenChoreo IDP token to every outbound request
  regardless of destination.

  Requests bound for an OpenChoreo backend now go through a new
  `openChoreoFetchApiRef`, which decorates the host's `fetchApiRef` instead of
  replacing it. The host keeps its middleware, and OpenChoreo credentials travel
  only to OpenChoreo.

  Destinations are checked rather than trusted: the IDP token is attached only to
  requests bound for `backend.baseUrl`, so a caller passing an unrelated URL
  cannot send the user's credentials to a third party. Direct mode (the
  `x-openchoreo-direct` signal) remains an explicit per-request opt-in for
  external OpenChoreo services.

  The token itself comes from a new `openChoreoTokenApiRef` capability rather
  than from a named auth provider. The default implementation sources it from the
  `openchoreo-auth` OAuth provider exactly as before, so nothing changes for the
  portal; a host whose own session already carries an OpenChoreo-accepted token
  can now override that one API instead of forking the plugins.

  `OpenChoreoFetchApi` from `@openchoreo/backstage-plugin` is deprecated and no
  longer registered. `OPENCHOREO_TOKEN_HEADER` and `OPENCHOREO_DIRECT_HEADER` are
  now exported from `@openchoreo/backstage-plugin-common` as the single
  definition shared by both sides of the wire.

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
- Updated dependencies [f5ca212]
- Updated dependencies [c67978a]
- Updated dependencies [cdc4c6e]
  - @openchoreo/openchoreo-client-node@2.0.0-next.0

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
