# @openchoreo/backstage-plugin-platform-engineer-core

## 1.2.0-next.3

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

- 591df85: Route the platform "planes" fetches through the response cache so they paint
  instantly on revisit instead of re-fetching from the catalog/BFF every time.

  The caching migration had skipped the `platform-engineer-core` plugin, so the
  Platform Engineer home/dashboard re-queried every plane list on each visit.
  Migrated the three dashboard widgets (`HomePagePlatformDetailsCard`,
  `InfrastructureWidget`, `AgentHealthWidget`) and the two observability-plane
  "linked planes" cards in the openchoreo plugin to `useOpenChoreoQuery` with
  domain-prefixed keys.

- 62608f5: chore: remove dead code left over from the OpenAPI-client and New Frontend
  System migrations — commented-out blocks, orphaned files/components, and unused
  deprecated exports (`LogEntry`/`RuntimeLogsResponse` aliases, `FILTER_PRESETS`,
  `useOrgName`, `useRCAReportByAlert`, `UserTypeConfig`), plus consolidation of
  duplicated backend response-type wrappers. No behavioural changes.
- e3986a9: Add an `/alpha` entry point that exposes each plugin as a `createFrontendPlugin` for use with Backstage's New Frontend System (NFS). The default entry continues to export the legacy `createPlugin` instance so existing host apps keep working unchanged; adopters on NFS can now import `from '@openchoreo/backstage-plugin-<name>/alpha'` and include the plugin directly in `createApp({ features: [...] })`.

  The `/alpha` exports register each plugin's API factories (e.g. `openChoreoCiClientApiRef`, `genericWorkflowsClientApiRef`, the three observability backend clients, `openChoreoClientApiRef`) and one top-level page where applicable (`platform-engineer-core`'s dashboard view, `openchoreo-workflows`' generic workflows page, `openchoreo-ci`'s workflows entity tab).

  Entity tabs and overview cards that previously lived in the host's `EntityPage.tsx` now ride through each plugin's `/alpha` export as `EntityContentBlueprint` and `EntityCardBlueprint` extensions, with the right kind filters. Adopters on `/alpha` get the full entity-page contributions automatically: the OpenChoreo CI plugin contributes the Build tab (scoped to `kind:component`); the observability plugin contributes the 10 component- and system-page tabs (Logs, Events, Metrics, Alerts, Wirelogs, Traces, Incidents, RCA Reports, Cost Analysis) plus a registry API for host-injected log-row action renderers; the OpenChoreo plugin contributes the Deploy tab, the system Cell Diagram tab, the shared Resource Definition tab, and 30+ overview cards spanning every OpenChoreo platform kind (Environment, DataPlane, WorkflowPlane, ObservabilityPlane, DeploymentPipeline, the ComponentType / ResourceType / TraitType families, and the Workflow family); the generic-workflows plugin contributes the Runs tab on `Workflow` and `ClusterWorkflow` entities of type `Generic`. The react plugin exposes a new `FeatureGatedContent` component so plugin authors can gate routable extensions on the OpenChoreo feature flags without rolling their own empty-state wrapper.

  Custom catalog-graph relations, entity-presentation kind icons, and the scaffolder form-decorator override are now actually applied at runtime — the original migration registered them but they were silently overwritten by upstream defaults at startup. The form-decorator override also stops dropping decorators contributed by other plugins.

  Adopters still on the default (legacy) export are unaffected. This addresses the body of [openchoreo/openchoreo#3568](https://github.com/openchoreo/openchoreo/issues/3568) — adopters can drop `--legacy` from the `@backstage/create-app` step when installing the plugin suite into an existing Backstage host.

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

## 1.2.0-next.0

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

- Compatible release for OpenChoreo 1.1.1.

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
