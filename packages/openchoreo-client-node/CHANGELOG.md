# @openchoreo/openchoreo-client-node

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
