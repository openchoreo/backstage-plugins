# @openchoreo/backstage-plugin-scaffolder-backend-module

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

- 6ac94f5: Email notification channels can set a sender display name. The create form adds an optional
  "Sender Name" field (`emailConfig.fromName`), the scaffolder action forwards it to the OpenChoreo
  API, and the channel overview card shows the sender as `Name <address>`. The client is regenerated
  for the new `NotificationEmailConfig.fromName` field.

### Patch Changes

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
- Updated dependencies [597beb1]
- Updated dependencies [02c5a87]
- Updated dependencies [6268316]
  - @openchoreo/backstage-plugin-common@2.0.0-next.3
  - @openchoreo/backstage-plugin-catalog-backend-module@2.0.0-next.3
  - @openchoreo/openchoreo-client-node@2.0.0-next.3

## 1.4.0-m.2

### Minor Changes

- 1cec15b: Notification channels can send HTML email bodies. The create form exposes the email
  template's `contentType` (`text/plain` or `text/html`), the scaffolder action forwards it to the
  OpenChoreo API, and the channel overview card shows it. The client is regenerated for the new
  `NotificationEmailTemplate.contentType` field.

### Patch Changes

- Updated dependencies [1cec15b]
  - @openchoreo/backstage-plugin-catalog-backend-module@2.0.0-next.2
  - @openchoreo/openchoreo-client-node@2.0.0-next.2
  - @openchoreo/backstage-plugin-common@2.0.0-next.2

## 1.4.0-m.1

### Patch Changes

- c67978a: Replace Backstage CLI boilerplate in published package descriptions and READMEs with
  real ones, so the npm listings describe what each package does and point at the install
  guide. No code changes.
- Updated dependencies [acc4c81]
- Updated dependencies [9e3a840]
- Updated dependencies [f5ca212]
- Updated dependencies [44795b9]
- Updated dependencies [c67978a]
- Updated dependencies [cdc4c6e]
  - @openchoreo/backstage-plugin-catalog-backend-module@2.0.0-next.0
  - @openchoreo/backstage-plugin-common@2.0.0-next.0
  - @openchoreo/openchoreo-client-node@2.0.0-next.0
  - @openchoreo/openchoreo-auth@2.0.0-next.0

## 1.3.0

### Patch Changes

- 9130de9: Authenticate backend-to-backend calls (scaffolder catalog reads and the
  sign-in `cache-capabilities` hook) with a service identity so they no longer
  return `401` once the default auth policy is enforced.
- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [c234b33]
- Updated dependencies [a958b80]
- Updated dependencies [ce31a0e]
- Updated dependencies [0a7d538]
- Updated dependencies [67ba0da]
- Updated dependencies [9eb3d31]
- Updated dependencies [435463f]
  - @openchoreo/backstage-plugin-common@1.3.0
  - @openchoreo/openchoreo-client-node@1.3.0
  - @openchoreo/backstage-plugin-catalog-backend-module@1.3.0
  - @openchoreo/openchoreo-auth@1.3.0

## 1.3.0-next.0

### Patch Changes

- 9130de9: Authenticate backend-to-backend calls (scaffolder catalog reads and the
  sign-in `cache-capabilities` hook) with a service identity so they no longer
  return `401` once the default auth policy is enforced.
- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [c234b33]
- Updated dependencies [a958b80]
- Updated dependencies [ce31a0e]
- Updated dependencies [0a7d538]
- Updated dependencies [67ba0da]
- Updated dependencies [9eb3d31]
- Updated dependencies [435463f]
  - @openchoreo/backstage-plugin-common@1.3.0-next.0
  - @openchoreo/openchoreo-client-node@1.3.0-next.0
  - @openchoreo/backstage-plugin-catalog-backend-module@1.3.0-next.0

## 1.2.0

### Minor Changes

- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 14f1052: Add a default-on Auto Deploy toggle to the project creation wizard. When on, `openchoreo:project:create` creates one unpinned ProjectReleaseBinding per deployment-pipeline environment after the project is created, and the control plane seeds the release pin once the first release is cut. Toggling it off shows a warning that the project must be deployed manually from its Deploy tab before components can be deployed. The Deploy tab now shows just-created unpinned bindings (`ProjectReleaseNotSet`) as pending instead of failed.

### Patch Changes

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

- Updated dependencies [ffa762f]
- Updated dependencies [18e51cf]
- Updated dependencies [62608f5]
- Updated dependencies [529f13c]
- Updated dependencies [cf2203a]
- Updated dependencies [39d264c]
- Updated dependencies [383e7f6]
- Updated dependencies [52396b0]
- Updated dependencies [14f1052]
- Updated dependencies [8416223]
- Updated dependencies [71f7b6c]
- Updated dependencies [2f45e83]
- Updated dependencies [284fcd7]
- Updated dependencies [56b4e95]
- Updated dependencies [8d8bd80]
- Updated dependencies [d19ffcf]
  - @openchoreo/backstage-plugin-catalog-backend-module@1.2.0
  - @openchoreo/backstage-plugin-common@1.2.0
  - @openchoreo/openchoreo-client-node@1.2.0
  - @openchoreo/openchoreo-auth@1.2.0

## 1.2.0-next.2

### Patch Changes

- Updated dependencies [52396b0]
- Updated dependencies [56b4e95]
  - @openchoreo/openchoreo-client-node@1.2.0-next.2
  - @openchoreo/backstage-plugin-catalog-backend-module@1.2.0-next.2
  - @openchoreo/backstage-plugin-common@1.2.0-next.2

## 1.2.0-next.3

### Minor Changes

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
- Updated dependencies [14f1052]
- Updated dependencies [8416223]
- Updated dependencies [71f7b6c]
- Updated dependencies [2f45e83]
- Updated dependencies [284fcd7]
  - @openchoreo/backstage-plugin-catalog-backend-module@1.2.0-next.3
  - @openchoreo/backstage-plugin-common@1.2.0-next.3
  - @openchoreo/openchoreo-client-node@1.2.0-next.3

## 1.2.0-next.0

### Patch Changes

- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

- Updated dependencies [ffa762f]
- Updated dependencies [529f13c]
- Updated dependencies [8d8bd80]
  - @openchoreo/backstage-plugin-catalog-backend-module@1.2.0-next.0
  - @openchoreo/backstage-plugin-common@1.2.0-next.0
  - @openchoreo/openchoreo-client-node@1.2.0-next.0
  - @openchoreo/openchoreo-auth@1.2.0-next.0

## 1.1.1

- Compatible release for OpenChoreo 1.1.1.

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
