# @openchoreo/backstage-plugin

## 1.2.0-next.3

### Minor Changes

- 5222138: Add an environment-aware API Try Out console (Swagger UI for OpenAPI, GraphiQL for GraphQL) to the component API view
- 86957df: Cell Diagram: each component node's ⋮ menu now links to that component's key tabs — Overview, Deploy, Logs, Metrics, and (when an environment has Cilium-backed network observability) Wirelogs — in a project's Cell Diagram tab.
- f126bca: Block deploying a component to an environment where its project is not deployed, and guide the user to deploy the project first.
- cf2203a: Add a pod-aware exec terminal in the Deploy view. The Terminal lives in the K8s resource-tree drawer reached via Deploy → environment → View K8s Artifacts: it appears as a tab on the Pod node's drawer (with a container picker) when the pod is rendered in the tree, and falls back to the ReleaseBinding drawer when the pod is managed by another operator and the binding is healthy. The exec session targets the selected pod and container via WebSocket. The standalone component-level Terminal tab has been removed.

  Access is gated by the `openchoreo.exec` permission with per-environment ABAC, and the `POST /exec/init` backend endpoint now enforces this permission server-side so direct API calls cannot bypass the UI gate.

- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- e384b25: Show **Summary** and **Definition** tabs on the release details page when a rendered release is selected in the resource tree. The Summary tab lists the release's status conditions alongside its owning project, component, environment and target plane, so a failed apply to the data plane surfaces directly in the drawer as `ResourcesApplied=False` with the apply error as the condition message. The Definition tab renders the full rendered release as YAML.

  Rendered releases are not given an Events tab: the release controllers report state through status conditions rather than Kubernetes events, so it would always be empty. Events remain available on the individual resources under a release.

- 284fcd7: Surface OpenChoreo controller auto-deploy failures in the Deploy tab. Pre-binding release-generation failures (bad trait, invalid config — from `Component.status.conditions`) now surface on the Setup card and as an error marker on the canvas Set-up tile, instead of leaving the user with no signal. Post-binding render/apply failures (from `ReleaseBinding.status.conditions`) show an actionable error banner with the controller's reason + message in the environment detail panel, instead of a context-free "Failed" badge. Long controller messages are clamped to a compact banner with a "View details" dialog (reason + full message + copy).
- 453b958: Show a "Suspended" status in the deployment pipeline when a component's workload is scaled to zero. The backend reads the suspended state that core already reports on the ReleaseBinding's ResourcesReady condition, and the pipeline badge now shows "Suspended" instead of "Active" for a scaled-to-zero workload.

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

- c86de7f: Cache catalog reads and switch the response cache to always-revalidate.

  The catalog list and entity pages now read through a `CachingCatalogApi` wrapper
  (exported from `@openchoreo/backstage-plugin-react`) that routes
  `getEntities`/`queryEntities`/`getEntityByRef`/`getEntitiesByRefs` through the
  shared `queryClient`, keyed per signed-in user. Previously the catalog used
  Backstage's `CatalogApi` directly, so every visit re-fetched from scratch and
  flashed a loading skeleton; now a revisited catalog list or entity page paints
  instantly from the warm cache. Catalog writes (`refreshEntity`, location
  add/remove/update, `removeEntityByUid`) invalidate the cache so user changes show
  immediately.

  The `queryClient` default `staleTime` changes from 30s to 0 (always
  stale-while-revalidate): a revisited surface paints cached data instantly and
  always runs a background refresh, so nothing on screen is left silently stale.
  The two hooks that set an explicit 30s `staleTime` now inherit this default.

  The entity-header breadcrumb dropdowns (namespace/project/component sibling
  lists) now read their data through `useOpenChoreoQuery` instead of an imperative
  `await catalogApi.getEntities(...)`, so reopening a level renders the cached list
  instantly (no loading spinner) and only revalidates in the background, rather
  than blocking on the network every open.

  The catalog list page seeds its initial rows from the cached `queryEntities`
  response (via the newly exported `useUserScopedKey`), so returning to a
  previously viewed list paints instantly from cache instead of flashing a
  skeleton while `useEntityList` re-fetches. `useUserScopedKey` is now exported
  from `@openchoreo/backstage-plugin-react`.

  Both cached-first surfaces now show a quiet inline spinner next to their label
  (the "All Components (N)" count and the breadcrumb menu title) while their
  background revalidation runs, so a refresh is visible instead of the data
  swapping in silently. The spinner tracks the real network refetch on the shared
  `queryClient` (via `useIsFetching`), not the surface's own `loading` flag —
  which resolves the instant the cached read returns while the revalidation is
  still in flight.

- 591df85: Route the platform "planes" fetches through the response cache so they paint
  instantly on revisit instead of re-fetching from the catalog/BFF every time.

  The caching migration had skipped the `platform-engineer-core` plugin, so the
  Platform Engineer home/dashboard re-queried every plane list on each visit.
  Migrated the three dashboard widgets (`HomePagePlatformDetailsCard`,
  `InfrastructureWidget`, `AgentHealthWidget`) and the two observability-plane
  "linked planes" cards in the openchoreo plugin to `useOpenChoreoQuery` with
  domain-prefixed keys.

- 436c144: Bring the Cell Diagram library into the repo as the internal package
  `@openchoreo/cell-diagram` (previously the external `@wso2/cell-diagram`). The
  exported API is unchanged; the frontend and backend plugins now consume the
  workspace package.
- 62608f5: chore: remove dead code left over from the OpenAPI-client and New Frontend
  System migrations — commented-out blocks, orphaned files/components, and unused
  deprecated exports (`LogEntry`/`RuntimeLogsResponse` aliases, `FILTER_PRESETS`,
  `useOrgName`, `useRCAReportByAlert`, `UserTypeConfig`), plus consolidation of
  duplicated backend response-type wrappers. No behavioural changes.
- d5eff9e: Use the standard Backstage `EmptyState` for the Deploy tab's empty and error states (Component, Project, and Resource), matching the look of other empty states in the app (e.g. "Workflows Not Available" on the Build tab). Replaces the card + custom message + Retry button with a title + description empty state, and the "no environments" state now links to the project's deployment pipeline so it can be reviewed/configured.
- f1163a9: Fix the Deploy views defaulting to every environment in the namespace when a project's deployment pipeline defines no environments. A resolved pipeline with no promotion paths now yields no environments (the UI shows its empty state), and a pipeline that cannot be resolved (missing `deploymentPipelineRef` or a failed pipeline fetch) surfaces an error state instead of silently listing all environments.

  A permission denial on the deployment-pipeline read (`deploymentpipelines:view`) now surfaces as a Forbidden state instead of a misleading "pipeline missing/misconfigured" error.

  The Component, Project, and Resource Deploy tabs now share the same empty-state and error-state cards (icon, message, and Retry) with consistent, pipeline-focused copy, replacing the plain text lines previously shown on the Project and Resource tabs.

- 0d2433f: Fix sidebar section separators rendering as dark near-black lines in production
  builds. The softening rule targeted the divider by its `BackstageSidebarDivider-root`
  class prefix, which JSS mangles away in the production bundle; it now targets the
  sidebar-nav `hr` element directly, so the light-mode divider stays a subtle grey in
  both dev and prod.
- e3986a9: Add an `/alpha` entry point that exposes each plugin as a `createFrontendPlugin` for use with Backstage's New Frontend System (NFS). The default entry continues to export the legacy `createPlugin` instance so existing host apps keep working unchanged; adopters on NFS can now import `from '@openchoreo/backstage-plugin-<name>/alpha'` and include the plugin directly in `createApp({ features: [...] })`.

  The `/alpha` exports register each plugin's API factories (e.g. `openChoreoCiClientApiRef`, `genericWorkflowsClientApiRef`, the three observability backend clients, `openChoreoClientApiRef`) and one top-level page where applicable (`platform-engineer-core`'s dashboard view, `openchoreo-workflows`' generic workflows page, `openchoreo-ci`'s workflows entity tab).

  Entity tabs and overview cards that previously lived in the host's `EntityPage.tsx` now ride through each plugin's `/alpha` export as `EntityContentBlueprint` and `EntityCardBlueprint` extensions, with the right kind filters. Adopters on `/alpha` get the full entity-page contributions automatically: the OpenChoreo CI plugin contributes the Build tab (scoped to `kind:component`); the observability plugin contributes the 10 component- and system-page tabs (Logs, Events, Metrics, Alerts, Wirelogs, Traces, Incidents, RCA Reports, Cost Analysis) plus a registry API for host-injected log-row action renderers; the OpenChoreo plugin contributes the Deploy tab, the system Cell Diagram tab, the shared Resource Definition tab, and 30+ overview cards spanning every OpenChoreo platform kind (Environment, DataPlane, WorkflowPlane, ObservabilityPlane, DeploymentPipeline, the ComponentType / ResourceType / TraitType families, and the Workflow family); the generic-workflows plugin contributes the Runs tab on `Workflow` and `ClusterWorkflow` entities of type `Generic`. The react plugin exposes a new `FeatureGatedContent` component so plugin authors can gate routable extensions on the OpenChoreo feature flags without rolling their own empty-state wrapper.

  Custom catalog-graph relations, entity-presentation kind icons, and the scaffolder form-decorator override are now actually applied at runtime — the original migration registered them but they were silently overwritten by upstream defaults at startup. The form-decorator override also stops dropping decorators contributed by other plugins.

  Adopters still on the default (legacy) export are unaffected. This addresses the body of [openchoreo/openchoreo#3568](https://github.com/openchoreo/openchoreo/issues/3568) — adopters can drop `--legacy` from the `@backstage/create-app` step when installing the plugin suite into an existing Backstage host.

- 0b1d374: Display role actions consistently in collapsed form in Access Control. When a
  role grants every action in a category, the Roles table and Role dialog now
  show a single "All <category> actions" entry (e.g. "All alerts actions", "All
  metrics actions") instead of listing each operation individually, matching how
  the action selection dialog already renders them. Roles are still stored as-is;
  the collapsing is display-only and re-applies once the action catalog loads.
- 8416223: Add a per-ProjectType "Create Project" wizard, mirroring the Resource creation flow.

  Each `ProjectType` / `ClusterProjectType` now generates a scaffolder Template via `PtdToTemplateConverter`, surfaced under a new `?view=projects` browse view with a dedicated "Project" landing card. Selecting a type opens a wizard whose parameters step is driven by the type's `spec.parameters.openAPIV3Schema`, then creates the Project with `spec.type` and `spec.parameters` set via the extended `openchoreo:project:create` action (it falls back to the OpenChoreo API default when these are omitted, keeping the legacy path working). The catalog provider emits these templates during full sync and the event-delta path keeps them current. Replaces the static `create-openchoreo-project` template.

- 71f7b6c: Add a "Deploy" tab to the Project entity page for the project-release lifecycle.

  The tab renders the project's deployment pipeline as a DAG of environments with live status and drives deploy/promote through `ProjectRelease` / `ProjectReleaseBinding`. A "Set up" card opens a **Configure & Deploy** wizard: step 1 edits `Project.spec.parameters` against the `(Cluster)ProjectType` parameters schema (saving cuts a new `ProjectRelease`), step 2 pins the first environment's binding and edits its `environmentConfigs` overrides. Each environment node supports **Promote** (copy the pinned release forward to the next environment) and **Configure overrides**; all mutating actions gate on the project-update permission.

  Backed by new BFF endpoints (`/project-environment-info`, `/project-release-bindings`, `/update-project-release-binding`, `/project-release-schema`) and matching `OpenChoreoClient` methods.

- 2f45e83: Add Backstage catalog and UI support for the new OpenChoreo `ProjectType` (namespaced) and `ClusterProjectType` (cluster-scoped) platform-engineer abstractions introduced by the project-release-lifecycle epic.

  The catalog provider now ingests both kinds (full sync and near-real-time event deltas), translates them into dedicated entity kinds, and links each `Project` to the `ProjectType` / `ClusterProjectType` it references via `spec.type` (an `instanceOf` / `hasInstance` relation). Both kinds get first-class Overview pages — rendering their `parameters` / `environmentConfigs` schemas, `validations`, and `resources` templates — plus a Definition tab showing the raw CR, and they appear throughout the catalog UI (kind registry, icons, graph labels, About card).

  Permission wiring enables create / edit / delete on both kinds for authorized users, and a scaffolder creation wizard is added for each (grouped under "Platform Resources"). The generated OpenChoreo API client is re-synced from core `main` to pick up the `ProjectType` / `ClusterProjectType` schemas, their REST endpoints, and the new `Project.spec.type` field.

- 14601f4: Clarify the save/discard/delete controls in the Workload editor rows
  (endpoints, dependencies, environment variables, and file mounts). While
  editing a row, a labeled footer bar (Save / Cancel / Delete) makes committing
  or discarding clearly visible; read-only rows keep their compact inline
  Edit / Delete buttons on a single line. Adds a reusable `EditRowActions`
  design-system component shared by all of those row editors.
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

- Updated dependencies [591df85]
- Updated dependencies [c86de7f]
- Updated dependencies [18e51cf]
- Updated dependencies [436c144]
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
  - @openchoreo/cell-diagram@1.2.0-next.3

## 1.2.0-next.0

### Patch Changes

- e809b2d: Limit the condition action selector to actions compatible with the current selection, so only actions sharing a condition attribute are offered.
- c7c41b7: Disable the primary action (Create Release / Save Overrides / Deploy) on
  the deploy flow while an environment variable or file mount row is in
  edit mode, so users can't submit a half-typed row with an empty key or
  value.
- 84cfaeb: Auto-select a default card in the Environments deploy graph instead of
  landing users on an empty detail panel: first env with an active or
  pending deployment, else the first failed env, else the first undeployed
  env, falling back to the Setup card when only never-deployed envs exist.
  Only applies while nothing is selected, so it never overrides a manual
  choice.
- c6f1de1: Rework the Environments setup card auto-deploy experience: searchable
  release dropdown with a primary "New release" CTA, an empty-state
  panel for brand-new components, an optimistic auto-deploy toggle with
  inline "Saving…" feedback and permission-aware error handling, and a
  controller-truth "Last deployed release" row that polls for the new
  release after a save.
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

- Display resource entities in the project overview page. (#590)
- Runtime network observability toggle added to the cell diagram. (#578)
- Resource Deploy actions gated on environment-scoped permissions. (#577)

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
