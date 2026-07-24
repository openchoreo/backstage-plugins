# @openchoreo/backstage-design-system

## 1.2.0

### Minor Changes

- 453b958: Show a "Suspended" status in the deployment pipeline when a component's workload is scaled to zero. The backend reads the suspended state that core already reports on the ReleaseBinding's ResourcesReady condition, and the pipeline badge now shows "Suspended" instead of "Active" for a scaled-to-zero workload.
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

- 62608f5: chore: remove dead code left over from the OpenAPI-client and New Frontend
  System migrations — commented-out blocks, orphaned files/components, and unused
  deprecated exports (`LogEntry`/`RuntimeLogsResponse` aliases, `FILTER_PRESETS`,
  `useOrgName`, `useRCAReportByAlert`, `UserTypeConfig`), plus consolidation of
  duplicated backend response-type wrappers. No behavioural changes.
- 0d2433f: Fix sidebar section separators rendering as dark near-black lines in production
  builds. The softening rule targeted the divider by its `BackstageSidebarDivider-root`
  class prefix, which JSS mangles away in the production bundle; it now targets the
  sidebar-nav `hr` element directly, so the light-mode divider stays a subtle grey in
  both dev and prod.
- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 14601f4: Clarify the save/discard/delete controls in the Workload editor rows
  (endpoints, dependencies, environment variables, and file mounts). While
  editing a row, a labeled footer bar (Save / Cancel / Delete) makes committing
  or discarding clearly visible; read-only rows keep their compact inline
  Edit / Delete buttons on a single line. Adds a reusable `EditRowActions`
  design-system component shared by all of those row editors.
- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

## 1.2.0-next.3

### Minor Changes

- 453b958: Show a "Suspended" status in the deployment pipeline when a component's workload is scaled to zero. The backend reads the suspended state that core already reports on the ReleaseBinding's ResourcesReady condition, and the pipeline badge now shows "Suspended" instead of "Active" for a scaled-to-zero workload.
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

- 62608f5: chore: remove dead code left over from the OpenAPI-client and New Frontend
  System migrations — commented-out blocks, orphaned files/components, and unused
  deprecated exports (`LogEntry`/`RuntimeLogsResponse` aliases, `FILTER_PRESETS`,
  `useOrgName`, `useRCAReportByAlert`, `UserTypeConfig`), plus consolidation of
  duplicated backend response-type wrappers. No behavioural changes.
- 0d2433f: Fix sidebar section separators rendering as dark near-black lines in production
  builds. The softening rule targeted the divider by its `BackstageSidebarDivider-root`
  class prefix, which JSS mangles away in the production bundle; it now targets the
  sidebar-nav `hr` element directly, so the light-mode divider stays a subtle grey in
  both dev and prod.
- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 14601f4: Clarify the save/discard/delete controls in the Workload editor rows
  (endpoints, dependencies, environment variables, and file mounts). While
  editing a row, a labeled footer bar (Save / Cancel / Delete) makes committing
  or discarding clearly visible; read-only rows keep their compact inline
  Edit / Delete buttons on a single line. Adds a reusable `EditRowActions`
  design-system component shared by all of those row editors.

## 1.2.0-next.0

### Patch Changes

- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

## 1.1.1

- Design system updates supporting the Project Contents card on the project overview page. (#590)

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
