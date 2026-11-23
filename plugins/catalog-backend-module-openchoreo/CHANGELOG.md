# @openchoreo/backstage-plugin-catalog-backend-module

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

- 6ac94f5: Email notification channels can set a sender display name. The create form adds an optional
  "Sender Name" field (`emailConfig.fromName`), the scaffolder action forwards it to the OpenChoreo
  API, and the channel overview card shows the sender as `Name <address>`. The client is regenerated
  for the new `NotificationEmailConfig.fromName` field.
- 597beb1: ReleaseLine entities carry `backstage.io/source-location` and `openchoreo.io/branch`, as components do. Both come from the component's workflow parameters with the line's override merged over them, so a line that overrides only its branch keeps the component's repository and app path. A line of a component built from an image gets neither. A line created or edited in the portal has them as soon as it reaches the catalog.

### Patch Changes

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

- 6268316: Sync the OpenChoreo API spec to openchoreo `12dce69e`.

  - **Endpoints:** `spec.visibility` accepts `project`, alongside namespace,
    internal and external (openchoreo#5491).
  - **Notification channels:** a webhook's URL can come from a secret
    (`webhookConfig.urlFrom`) instead of `webhookConfig.url`, so `url` is
    optional (openchoreo#5472). The catalog's notification channel entity keeps
    whichever one the channel has.

- Updated dependencies [11f6b1d]
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
- Updated dependencies [4808a76]
- Updated dependencies [02c5a87]
- Updated dependencies [6268316]
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@2.0.0-next.3
  - @openchoreo/backstage-plugin-common@2.0.0-next.3
  - @openchoreo/openchoreo-client-node@2.0.0-next.3

## 1.4.0-m.2

### Minor Changes

- 1cec15b: Notification channels can send HTML email bodies. The create form exposes the email
  template's `contentType` (`text/plain` or `text/html`), the scaffolder action forwards it to the
  OpenChoreo API, and the channel overview card shows it. The client is regenerated for the new
  `NotificationEmailTemplate.contentType` field.

### Patch Changes

- Updated dependencies [1cec15b]
  - @openchoreo/openchoreo-client-node@2.0.0-next.2
  - @openchoreo/backstage-plugin-common@2.0.0-next.2
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@2.0.0-next.2

## 1.4.0-m.1

### Minor Changes

- acc4c81: Make both packages work under Backstage backend feature discovery
  (`backend.add(discoveryFeatureLoader)`), which reads a package's **default**
  export only.

  `@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth` had no
  default export at all — `OpenChoreoAuthModule` was reachable as a named export
  alone, which is why the install guide adds it with
  `backend.add(OpenChoreoAuthModule)` while every sibling package uses a dynamic
  import. It is now also the default export.

  `@openchoreo/backstage-plugin-catalog-backend-module` exported the catalog
  module as its default, but `immediateCatalogServiceFactory` and
  `annotationStoreFactory` were named exports, so discovery installed the module
  without the two services it and `@openchoreo/backstage-plugin-backend` depend
  on. The default export is now a backend feature loader yielding all three.

  Existing explicit wiring is unaffected. A service factory installed explicitly
  with `backend.add(...)` takes precedence over one offered by a feature loader,
  and the loader's copy is ignored rather than colliding.

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
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@2.0.0-next.0
  - @openchoreo/openchoreo-auth@2.0.0-next.0

## 1.3.0

### Patch Changes

- 67ba0da: Refresh the parent System when a component is removed so its now-dangling
  `hasPart` relation is dropped. Without this, deleting a component left the
  project page showing "Some related entities could not be found in the catalog"
  until the catalog was rebuilt, because the System's relations are only
  recomputed when it is re-processed and the periodic full sync re-emits it
  unchanged.
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

- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [c234b33]
- Updated dependencies [a958b80]
- Updated dependencies [ce31a0e]
- Updated dependencies [0a7d538]
- Updated dependencies [435463f]
  - @openchoreo/backstage-plugin-common@1.3.0
  - @openchoreo/openchoreo-client-node@1.3.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.3.0
  - @openchoreo/openchoreo-auth@1.3.0

## 1.3.0-next.0

### Patch Changes

- 67ba0da: Refresh the parent System when a component is removed so its now-dangling
  `hasPart` relation is dropped. Without this, deleting a component left the
  project page showing "Some related entities could not be found in the catalog"
  until the catalog was rebuilt, because the System's relations are only
  recomputed when it is re-processed and the periodic full sync re-emits it
  unchanged.
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

- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [c234b33]
- Updated dependencies [a958b80]
- Updated dependencies [ce31a0e]
- Updated dependencies [0a7d538]
- Updated dependencies [435463f]
  - @openchoreo/backstage-plugin-common@1.3.0-next.0
  - @openchoreo/openchoreo-client-node@1.3.0-next.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.3.0-next.0

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
- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 14f1052: Add a default-on Auto Deploy toggle to the project creation wizard. When on, `openchoreo:project:create` creates one unpinned ProjectReleaseBinding per deployment-pipeline environment after the project is created, and the control plane seeds the release pin once the first release is cut. Toggling it off shows a warning that the project must be deployed manually from its Deploy tab before components can be deployed. The Deploy tab now shows just-created unpinned bindings (`ProjectReleaseNotSet`) as pending instead of failed.

### Patch Changes

- ffa762f: Fix stale form data in the component-creation Build & Deploy section.
  Generated templates now nest deploymentSource and its branch-specific
  fields (workflow_name, git_source, workflow_parameters, containerImage,
  autoDeploy, ciPlatform, ciIdentifier) under a single buildAndDeploy
  object rendered by a composite field, so switching deployment source
  clears the previous branch's data atomically — fixes
  "instance.workflow requires property \"name\"" when a user picks Build
  from Source and then switches to Container Image or External CI.
- 8416223: Add a per-ProjectType "Create Project" wizard, mirroring the Resource creation flow.

  Each `ProjectType` / `ClusterProjectType` now generates a scaffolder Template via `PtdToTemplateConverter`, surfaced under a new `?view=projects` browse view with a dedicated "Project" landing card. Selecting a type opens a wizard whose parameters step is driven by the type's `spec.parameters.openAPIV3Schema`, then creates the Project with `spec.type` and `spec.parameters` set via the extended `openchoreo:project:create` action (it falls back to the OpenChoreo API default when these are omitted, keeping the legacy path working). The catalog provider emits these templates during full sync and the event-delta path keeps them current. Replaces the static `create-openchoreo-project` template.

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
- Updated dependencies [1207eda]
- Updated dependencies [284fcd7]
- Updated dependencies [56b4e95]
- Updated dependencies [8d8bd80]
- Updated dependencies [d19ffcf]
  - @openchoreo/backstage-plugin-common@1.2.0
  - @openchoreo/openchoreo-client-node@1.2.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.2.0
  - @openchoreo/openchoreo-auth@1.2.0

## 1.2.0-next.2

### Patch Changes

- Updated dependencies [52396b0]
- Updated dependencies [56b4e95]
  - @openchoreo/openchoreo-client-node@1.2.0-next.2
  - @openchoreo/backstage-plugin-common@1.2.0-next.2
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.2.0-next.2

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
- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 14f1052: Add a default-on Auto Deploy toggle to the project creation wizard. When on, `openchoreo:project:create` creates one unpinned ProjectReleaseBinding per deployment-pipeline environment after the project is created, and the control plane seeds the release pin once the first release is cut. Toggling it off shows a warning that the project must be deployed manually from its Deploy tab before components can be deployed. The Deploy tab now shows just-created unpinned bindings (`ProjectReleaseNotSet`) as pending instead of failed.

### Patch Changes

- 8416223: Add a per-ProjectType "Create Project" wizard, mirroring the Resource creation flow.

  Each `ProjectType` / `ClusterProjectType` now generates a scaffolder Template via `PtdToTemplateConverter`, surfaced under a new `?view=projects` browse view with a dedicated "Project" landing card. Selecting a type opens a wizard whose parameters step is driven by the type's `spec.parameters.openAPIV3Schema`, then creates the Project with `spec.type` and `spec.parameters` set via the extended `openchoreo:project:create` action (it falls back to the OpenChoreo API default when these are omitted, keeping the legacy path working). The catalog provider emits these templates during full sync and the event-delta path keeps them current. Replaces the static `create-openchoreo-project` template.

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
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.2.0-next.3
  - @openchoreo/openchoreo-client-node@1.2.0-next.3

## 1.2.0-next.0

### Patch Changes

- ffa762f: Fix stale form data in the component-creation Build & Deploy section.
  Generated templates now nest deploymentSource and its branch-specific
  fields (workflow_name, git_source, workflow_parameters, containerImage,
  autoDeploy, ciPlatform, ciIdentifier) under a single buildAndDeploy
  object rendered by a composite field, so switching deployment source
  clears the previous branch's data atomically — fixes
  "instance.workflow requires property \"name\"" when a user picks Build
  from Source and then switches to Container Image or External CI.
- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

- Updated dependencies [529f13c]
- Updated dependencies [1207eda]
- Updated dependencies [8d8bd80]
  - @openchoreo/backstage-plugin-common@1.2.0-next.0
  - @openchoreo/openchoreo-client-node@1.2.0-next.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.2.0-next.0
  - @openchoreo/openchoreo-auth@1.2.0-next.0

## 1.1.1

- Compatible release for OpenChoreo 1.1.1.

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
