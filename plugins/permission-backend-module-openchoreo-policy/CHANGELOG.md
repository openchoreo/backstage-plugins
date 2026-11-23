# @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy

## 1.4.0-m.3

### Minor Changes

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

- 4808a76: Decide the Scorecards check read and manage permissions on the `scorecards:view`
  and `scorecards:manage` actions. Needs a control plane that registers them;
  against an older one, both permissions are denied.

### Patch Changes

- 11f6b1d: Shrink the catalog visibility condition so portal search stops failing for
  users who belong to many projects.

  `catalog.entity.read` resolves to a conditional decision carrying the user's
  capability paths for every OpenChoreo-managed kind. The permission framework
  repeats that payload once per authorized resource when it batches checks back
  to the catalog, and the catalog parses the batch with a fixed 100 KB body
  limit. A user holding a project-scoped role in each of their projects produced
  a payload large enough that a single page of search hits overflowed the limit,
  and the whole query failed with `There was a problem performing the search
query` (a 413 behind the scenes). Narrow searches with few hits still worked,
  which is what made it look like a search problem rather than an authorization
  one.

  Three changes keep the payload flat: paths already implied by a broader path
  in the same list are dropped (a role bound per project collapses into the
  namespace-wide grant that covers it), kinds that resolve to the same paths now
  share one entry instead of repeating it, and the kind list and the unused
  action name are no longer sent at all. The decisions themselves are unchanged
  — only their wire size. For the reported case this is roughly a 7x reduction
  per resource.

  Conditions produced by an earlier version are still understood, so a
  deployment that rolls the permission and catalog backends separately keeps
  working during the rollout.

- Updated dependencies [6268316]
- Updated dependencies [86d3c99]
- Updated dependencies [bff9b10]
- Updated dependencies [bff9b10]
- Updated dependencies [be71fce]
- Updated dependencies [bff9b10]
- Updated dependencies [bff9b10]
- Updated dependencies [8aa6389]
- Updated dependencies [6268316]
- Updated dependencies [bcbd114]
- Updated dependencies [6ac94f5]
- Updated dependencies [145586f]
- Updated dependencies [02c5a87]
- Updated dependencies [6268316]
  - @openchoreo/backstage-plugin-common@2.0.0-next.3
  - @openchoreo/openchoreo-client-node@2.0.0-next.3
  - @openchoreo/backstage-plugin-tech-insights-dynamic-checks-common@2.0.0-next.3

## 2.0.0-next.2

### Patch Changes

- Updated dependencies [1cec15b]
  - @openchoreo/openchoreo-client-node@2.0.0-next.2
  - @openchoreo/backstage-plugin-common@2.0.0-next.2

## 1.4.0-m.1

### Minor Changes

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
- Updated dependencies [9e3a840]
- Updated dependencies [f5ca212]
- Updated dependencies [44795b9]
- Updated dependencies [c67978a]
- Updated dependencies [cdc4c6e]
  - @openchoreo/backstage-plugin-common@2.0.0-next.0
  - @openchoreo/openchoreo-client-node@2.0.0-next.0
  - @openchoreo/openchoreo-auth@2.0.0-next.0

## 1.3.0

### Patch Changes

- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [c234b33]
- Updated dependencies [a958b80]
- Updated dependencies [ce31a0e]
- Updated dependencies [0a7d538]
- Updated dependencies [435463f]
  - @openchoreo/backstage-plugin-common@1.3.0
  - @openchoreo/openchoreo-client-node@1.3.0
  - @openchoreo/openchoreo-auth@1.3.0

## 1.3.0-next.0

### Patch Changes

- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [c234b33]
- Updated dependencies [a958b80]
- Updated dependencies [ce31a0e]
- Updated dependencies [0a7d538]
- Updated dependencies [435463f]
  - @openchoreo/backstage-plugin-common@1.3.0-next.0
  - @openchoreo/openchoreo-client-node@1.3.0-next.0

## 1.2.0

### Minor Changes

- 1207eda: Add `resource.resourceType` ABAC condition to resource creation, gating the resource template chooser and the creation wizard per resource type.

### Patch Changes

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

- Updated dependencies [18e51cf]
- Updated dependencies [62608f5]
- Updated dependencies [529f13c]
- Updated dependencies [cf2203a]
- Updated dependencies [39d264c]
- Updated dependencies [383e7f6]
- Updated dependencies [52396b0]
- Updated dependencies [8416223]
- Updated dependencies [71f7b6c]
- Updated dependencies [2f45e83]
- Updated dependencies [284fcd7]
- Updated dependencies [56b4e95]
- Updated dependencies [8d8bd80]
- Updated dependencies [d19ffcf]
  - @openchoreo/backstage-plugin-common@1.2.0
  - @openchoreo/openchoreo-client-node@1.2.0
  - @openchoreo/openchoreo-auth@1.2.0

## 1.2.0-next.2

### Patch Changes

- Updated dependencies [52396b0]
- Updated dependencies [56b4e95]
  - @openchoreo/openchoreo-client-node@1.2.0-next.2
  - @openchoreo/backstage-plugin-common@1.2.0-next.2

## 1.2.0-next.3

### Patch Changes

- 2f45e83: Add Backstage catalog and UI support for the new OpenChoreo `ProjectType` (namespaced) and `ClusterProjectType` (cluster-scoped) platform-engineer abstractions introduced by the project-release-lifecycle epic.

  The catalog provider now ingests both kinds (full sync and near-real-time event deltas), translates them into dedicated entity kinds, and links each `Project` to the `ProjectType` / `ClusterProjectType` it references via `spec.type` (an `instanceOf` / `hasInstance` relation). Both kinds get first-class Overview pages — rendering their `parameters` / `environmentConfigs` schemas, `validations`, and `resources` templates — plus a Definition tab showing the raw CR, and they appear throughout the catalog UI (kind registry, icons, graph labels, About card).

  Permission wiring enables create / edit / delete on both kinds for authorized users, and a scaffolder creation wizard is added for each (grouped under "Platform Resources"). The generated OpenChoreo API client is re-synced from core `main` to pick up the `ProjectType` / `ClusterProjectType` schemas, their REST endpoints, and the new `Project.spec.type` field.

- Updated dependencies [18e51cf]
- Updated dependencies [62608f5]
- Updated dependencies [cf2203a]
- Updated dependencies [39d264c]
- Updated dependencies [383e7f6]
- Updated dependencies [8416223]
- Updated dependencies [71f7b6c]
- Updated dependencies [2f45e83]
- Updated dependencies [284fcd7]
  - @openchoreo/backstage-plugin-common@1.2.0-next.3
  - @openchoreo/openchoreo-client-node@1.2.0-next.3

## 1.2.0-next.0

### Minor Changes

- 1207eda: Add `resource.resourceType` ABAC condition to resource creation, gating the resource template chooser and the creation wizard per resource type.

### Patch Changes

- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

- Updated dependencies [529f13c]
- Updated dependencies [8d8bd80]
  - @openchoreo/backstage-plugin-common@1.2.0-next.0
  - @openchoreo/openchoreo-client-node@1.2.0-next.0
  - @openchoreo/openchoreo-auth@1.2.0-next.0

## 1.1.1

- Compatible release for OpenChoreo 1.1.1.

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
