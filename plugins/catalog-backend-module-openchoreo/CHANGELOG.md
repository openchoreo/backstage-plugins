# @openchoreo/backstage-plugin-catalog-backend-module

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
