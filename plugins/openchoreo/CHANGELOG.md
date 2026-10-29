# @openchoreo/backstage-plugin

## 2.0.0-next.0

### Minor Changes

- d19949b: Contribute Access Control and Secrets as tabs on Backstage's user-settings
  page, so a host that installs the plugin gets them without wiring anything.

  `AccessControlPage` and `SecretsPage` were exported as plain components.
  Nothing mounted them, they had no route, and feature discovery could not
  surface them — the only page this plugin registered was the exec terminal.

  They now ship as `SubPageBlueprint` extensions attached to `page:user-settings`
  at `access-control` and `secrets`. Settings tabs rather than standalone pages,
  because that is where the OpenChoreo portal already places them: every host
  ends up with the same layout instead of the portal and its adopters diverging.
  A host that would rather place them itself can switch them off through
  `app.extensions`.

  Adds a `secretsRouteRef` alongside the existing `accessControlRouteRef` and
  exposes it on the plugin's `routes` map for binding.

- c15ee42: Make `@openchoreo/backstage-plugin/alpha` work under Backstage feature
  discovery. The default export is now a feature loader that yields the plugin
  together with `openChoreoAppModule`, instead of the plugin on its own.

  Feature discovery is enabled by default in new Backstage apps, but it only
  reads the _default_ export of a package's root and `./alpha` entry points.
  `openChoreoAppModule` was a named export, so a host that relied on discovery
  got the plugin without it — the entity tabs mounted and then threw on first
  render, because that module is what supplies the shared query client and the
  `fetchApi`/`permissionApi` overrides that attach the user's IDP token.

  `openChoreoEntityGroupsModule` is intentionally left out of the bundle: it is
  recommended rather than required, and hosts that pin their own entity tab
  groups should not have ours applied implicitly.

  The plugin itself is still available as the named export `openChoreoPlugin`,
  and listing any of these explicitly in `createApp({ features })` keeps
  working — a module applied twice simply re-applies the same implementation.

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

- 11907a6: Ship the OpenChoreo light and dark themes to every host that installs the
  plugins, instead of keeping them private to the portal.

  The built `AppTheme` entries, the `app.branding` reader, and the config schema
  that declares it all lived in `packages/portal-app`, which is not published. An
  external Backstage app installing the OpenChoreo plugins therefore rendered our
  surfaces against the stock Backstage palette: wrong contrast, a dark mode that
  painted `--bui-bg-app` grey, and no way to set a brand color.

  The design system now owns them. It exports `appThemes` plus `useBranding`,
  `brandName`, `readBrandingConfig`, and `DEFAULT_BRAND_NAME`, and carries the
  `app.branding.*` config schema. `openChoreoAppModule` registers both themes as
  `ThemeBlueprint` extensions, so feature discovery hands them to any host. They
  are additive — the host's own themes stay in the picker, and either can be
  turned off through `app.extensions`.

  `theme.light.primaryColor` and `theme.dark.primaryColor` now apply anywhere the
  themes are registered. `name`, `iconLogo`, and `fullLogo` still drive only the
  OpenChoreo portal's sidebar and sign-in card, since a host supplies its own
  app shell.

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

- f5ca212: Restore the Overview tab of notification channels, which has been empty since the entity pages moved to the
  New Frontend System. It shows the channel's configuration card again, with the About card and a catalog graph
  of the alert rules that notify the channel.
- c67978a: Replace Backstage CLI boilerplate in published package descriptions and READMEs with
  real ones, so the npm listings describe what each package does and point at the install
  guide. No code changes.
- 3275f94: Fix narrow rendering of the Access Control and Secrets settings tabs.

  The `SubPageBlueprint` loaders returned bare `<AccessControlContent />` /
  `<SecretsContent />`. When upstream's `page:user-settings` is rendered under
  a `<Page>`-based `core.page-layout` (what the OpenChoreo portal uses), the
  body ends up directly inside `<Page>`'s CSS grid without claiming the
  `pageContent` grid area, so it shrinks to its intrinsic width.

  Wrap both loader results in `<Content>` — the same pattern upstream's own
  General / Auth Providers / Feature Flags sub-pages use. Behavior under the
  default (flex-based) page layout is unchanged; the wrapper just adds the
  standard Backstage sub-page padding.

- Updated dependencies [9e3a840]
- Updated dependencies [f5ca212]
- Updated dependencies [44795b9]
- Updated dependencies [c67978a]
- Updated dependencies [11907a6]
- Updated dependencies [cdc4c6e]
  - @openchoreo/backstage-plugin-common@2.0.0-next.0
  - @openchoreo/backstage-plugin-react@2.0.0-next.0
  - @openchoreo/backstage-design-system@2.0.0-next.0
  - @openchoreo/cell-diagram@2.0.0-next.0

## 1.3.0

### Minor Changes

- 67ba0da: Add a per-row "Delete" action to the Project Contents table so a component
  can be deleted directly from the project listing without opening the
  component page first. The action surfaces as a per-row delete button for
  both component and resource rows (hidden for rows already marked for
  deletion), reuses the shared delete-confirmation dialog, and optimistically
  marks the row for deletion until the next catalog sync drops it.
- 2564efb: Ship the OpenChoreo frontend integration surface out of the base plugin so
  adopters no longer copy-paste boilerplate into their `packages/app/`.
  `@openchoreo/backstage-plugin/alpha` now exports:

  - **`openChoreoAppModule`** — a `createFrontendModule({ pluginId: 'app' })`
    that wraps the app root in `OpenChoreoQueryProvider` and overrides
    `fetchApiRef` + `permissionApiRef` with the OpenChoreo IDP-token-aware
    implementations. Previously each adopter had to hand-copy the
    `OpenChoreoFetchApi` / `OpenChoreoPermissionApi` classes plus three
    `ApiBlueprint.make(...)` factories (~150 lines) into a local
    `customAppModule.tsx`.
  - **`openChoreoEntityGroupsModule`** — an opt-in
    `createFrontendModule({ pluginId: 'catalog' })` that overrides
    `page:catalog/entity`'s `groupDefinitions` with the canonical OpenChoreo
    tab order (Definition → Build → Deploy → Cell Diagram → …). Every OC tab
    uses a unique `group:` key so the vanilla NFS dropdown-collapse never
    triggers and tabs render flat. Non-OC entity pages are unaffected — the
    six upstream default group names are retained in their vanilla relative
    order.
  - **`openChoreoAuthApiRef`**, **`OpenChoreoFetchApi`**,
    **`OpenChoreoPermissionApi`** — surfaced as public exports so
    `customAppModule.tsx` can reference them without local re-declaration.
  - **`openchoreo:inject-user-token`** scaffolder form decorator — now
    registered automatically as a `FormDecoratorBlueprint` extension.
    Templates that opt in via `EXPERIMENTAL_formDecorators` in their spec get
    the signed-in user's IDP token injected as the `OPENCHOREO_USER_TOKEN`
    template secret with no adopter-side wiring.

  Group values on OpenChoreo entity content tabs were also uniqued across the
  three plugins (`deployment` → `deploy` / `build` / `cell-diagram` /
  `diagram`, `runtime` → `logs` / `events` / `metrics` / `alerts` /
  `wirelogs`, `analysis` → `traces` / `incidents` / `rca-reports` /
  `cost-analysis`). Combined with `openChoreoEntityGroupsModule` this
  guarantees flat tab rendering under vanilla NFS chrome.

  Portal-app is unchanged for users. Internally, the plugin-owned modules
  replace ~200 lines of previously-hand-copied wiring in
  `packages/portal-app/src/apis/customOverrides.tsx` and
  `packages/portal-app/src/appModule.tsx`, and the standalone
  `openChoreoTokenDecorator.ts` file in `packages/portal-app/src/scaffolder/`
  is deleted.

- 67ba0da: Generalize the listing row delete beyond components. The new
  `useDeleteEntityDialog` hook (replacing `useDeleteComponentDialog`) dispatches
  deletes for every kind the OpenChoreo API supports — components, projects,
  namespaces, resources and the platform resource kinds — sharing one dispatch
  with the entity-page context menu. A reusable `RowDeleteButton` +
  `usePendingDeletionOverlay` pair wires per-row delete (with an optimistic
  "marked for deletion" badge) into the catalog "All ..." pages, the namespace
  projects/resources cards, and extends the Project Contents row action to
  resource rows.
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

- 762b22a: Complete the New Frontend System migration for the portal shell and
  distribute scaffolder field extensions through the base plugin.

  **Portal**: `convertLegacyAppRoot` and `Root.tsx` are gone. Themes, icons,
  sidebar (`NavContentBlueprint`), provider stack, and every route now
  ship as NFS blueprints.

  **Adopter-facing additions**:

  - `@openchoreo/backstage-plugin/alpha` — `execTerminalPage`, 32
    `FormFieldBlueprint`s for OC template fields, plus new component
    exports (`ScaffolderPreselectionProvider`, `EntityWarningStrip`,
    `ForeignCardsSection`)
  - `@openchoreo/backstage-plugin-openchoreo-observability/alpha` —
    `costInsightsPage` with sidebar auto-discovery
  - `@openchoreo/backstage-plugin-platform-engineer-core/alpha` —
    `platformOverviewPage` with sidebar auto-discovery; `PlatformOverviewPage`
    source moved from portal-app
  - `@openchoreo/backstage-plugin-react` — `useQueryParams` (backwards-compat
    re-export left in `@openchoreo/backstage-plugin`)

- 36f0982: Surface the deployed OpenChoreo platform version in the Console. The backend
  gains a `GET /platform-version` route proxying the OpenChoreo API server's
  public `/version` endpoint; the frontend gains `getPlatformVersion()` on the
  client and a `PlatformAboutCard` component. The stock portal shows the card
  in Settings → General next to the stock user-settings cards.
- d7f12e6: Restore the Portal Assistant surfaces that were dropped in the New Frontend
  System entity-page migration.

  Introduce a decoupled assistant-integration contract in
  `@openchoreo/backstage-plugin-react` (`portalAssistantIntegrationApiRef`,
  `usePortalAssistant`, `BuildFailureNotifierSlot`) so no plugin depends on the
  private portal-assistant plugin. The OpenChoreo plugins consume it: the
  component Overview layout and the Workflows (Build) page mount
  `BuildFailureNotifierSlot`, and the deploy panel (`Environments`) falls back
  to the contract's `renderInvestigateAction` slot when mounted propless.

  The portal app registers the provider for these slots (the composition root
  owns the portal-assistant dependency), wiring the failed-build launcher and
  the deploy-panel "Investigate with AI" action back in. With the assistant
  feature enabled, the failed-build prompt reappears on the Overview and Build
  tabs and the investigate action on a pending/failed deployment. When no
  assistant is registered every slot renders nothing.

- 0c85b6b: Render trait configuration forms using `x-openchoreo-backstage-portal` schema annotations. The Add/Edit trait dialogs now fold these vendor extensions (e.g. `ui:order`, `ui:widget`, `ui:title`, `ui:placeholder`) into the RJSF uiSchema, letting trait authors control form rendering. Traits without annotations are unaffected.

### Patch Changes

- c2acee5: Support frameless rendering for widgets embedded in a home page card. `SummaryWidgetWrapper` gains a `disableCard` prop and `MyProjectsWidget` forwards it; `QuickActionsSection` gains a `hideTitle` prop. These let the components render body-only content when an outer card extension already provides the card frame and title, avoiding duplicated headers.
- cc2fe12: Publish `@openchoreo/*` to the public npm registry instead of GitHub Packages. Installing the plugins no longer requires a GitHub personal access token or any registry configuration. Releases are published from CI via npm trusted publishing (OIDC), so every version from this release onward carries a signed provenance attestation.
- 23f804a: Render `<resource:name>` entity tags in RCA reports as catalog links, instead
  of dropping them as unknown HTML along with the resource name. Clamp resource
  parameter values to three lines, so a long value no longer stretches every
  card in the overview row.
- Updated dependencies [f39a20c]
- Updated dependencies [4c7f96c]
- Updated dependencies [526e7ac]
- Updated dependencies [202d582]
- Updated dependencies [d00d48b]
- Updated dependencies [45caff4]
- Updated dependencies [a958b80]
- Updated dependencies [c2acee5]
- Updated dependencies [67ba0da]
- Updated dependencies [497b480]
- Updated dependencies [ce31a0e]
- Updated dependencies [762b22a]
- Updated dependencies [0a7d538]
- Updated dependencies [d7f12e6]
  - @openchoreo/backstage-design-system@1.3.0
  - @openchoreo/backstage-plugin-common@1.3.0
  - @openchoreo/backstage-plugin-react@1.3.0
  - @openchoreo/cell-diagram@1.3.0

## 1.3.0-next.0

### Minor Changes

- 67ba0da: Add a per-row "Delete" action to the Project Contents table so a component
  can be deleted directly from the project listing without opening the
  component page first. The action surfaces as a per-row delete button for
  both component and resource rows (hidden for rows already marked for
  deletion), reuses the shared delete-confirmation dialog, and optimistically
  marks the row for deletion until the next catalog sync drops it.
- 2564efb: Ship the OpenChoreo frontend integration surface out of the base plugin so
  adopters no longer copy-paste boilerplate into their `packages/app/`.
  `@openchoreo/backstage-plugin/alpha` now exports:

  - **`openChoreoAppModule`** — a `createFrontendModule({ pluginId: 'app' })`
    that wraps the app root in `OpenChoreoQueryProvider` and overrides
    `fetchApiRef` + `permissionApiRef` with the OpenChoreo IDP-token-aware
    implementations. Previously each adopter had to hand-copy the
    `OpenChoreoFetchApi` / `OpenChoreoPermissionApi` classes plus three
    `ApiBlueprint.make(...)` factories (~150 lines) into a local
    `customAppModule.tsx`.
  - **`openChoreoEntityGroupsModule`** — an opt-in
    `createFrontendModule({ pluginId: 'catalog' })` that overrides
    `page:catalog/entity`'s `groupDefinitions` with the canonical OpenChoreo
    tab order (Definition → Build → Deploy → Cell Diagram → …). Every OC tab
    uses a unique `group:` key so the vanilla NFS dropdown-collapse never
    triggers and tabs render flat. Non-OC entity pages are unaffected — the
    six upstream default group names are retained in their vanilla relative
    order.
  - **`openChoreoAuthApiRef`**, **`OpenChoreoFetchApi`**,
    **`OpenChoreoPermissionApi`** — surfaced as public exports so
    `customAppModule.tsx` can reference them without local re-declaration.
  - **`openchoreo:inject-user-token`** scaffolder form decorator — now
    registered automatically as a `FormDecoratorBlueprint` extension.
    Templates that opt in via `EXPERIMENTAL_formDecorators` in their spec get
    the signed-in user's IDP token injected as the `OPENCHOREO_USER_TOKEN`
    template secret with no adopter-side wiring.

  Group values on OpenChoreo entity content tabs were also uniqued across the
  three plugins (`deployment` → `deploy` / `build` / `cell-diagram` /
  `diagram`, `runtime` → `logs` / `events` / `metrics` / `alerts` /
  `wirelogs`, `analysis` → `traces` / `incidents` / `rca-reports` /
  `cost-analysis`). Combined with `openChoreoEntityGroupsModule` this
  guarantees flat tab rendering under vanilla NFS chrome.

  Portal-app is unchanged for users. Internally, the plugin-owned modules
  replace ~200 lines of previously-hand-copied wiring in
  `packages/portal-app/src/apis/customOverrides.tsx` and
  `packages/portal-app/src/appModule.tsx`, and the standalone
  `openChoreoTokenDecorator.ts` file in `packages/portal-app/src/scaffolder/`
  is deleted.

- 67ba0da: Generalize the listing row delete beyond components. The new
  `useDeleteEntityDialog` hook (replacing `useDeleteComponentDialog`) dispatches
  deletes for every kind the OpenChoreo API supports — components, projects,
  namespaces, resources and the platform resource kinds — sharing one dispatch
  with the entity-page context menu. A reusable `RowDeleteButton` +
  `usePendingDeletionOverlay` pair wires per-row delete (with an optimistic
  "marked for deletion" badge) into the catalog "All ..." pages, the namespace
  projects/resources cards, and extends the Project Contents row action to
  resource rows.
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

- 762b22a: Complete the New Frontend System migration for the portal shell and
  distribute scaffolder field extensions through the base plugin.

  **Portal**: `convertLegacyAppRoot` and `Root.tsx` are gone. Themes, icons,
  sidebar (`NavContentBlueprint`), provider stack, and every route now
  ship as NFS blueprints.

  **Adopter-facing additions**:

  - `@openchoreo/backstage-plugin/alpha` — `execTerminalPage`, 32
    `FormFieldBlueprint`s for OC template fields, plus new component
    exports (`ScaffolderPreselectionProvider`, `EntityWarningStrip`,
    `ForeignCardsSection`)
  - `@openchoreo/backstage-plugin-openchoreo-observability/alpha` —
    `costInsightsPage` with sidebar auto-discovery
  - `@openchoreo/backstage-plugin-platform-engineer-core/alpha` —
    `platformOverviewPage` with sidebar auto-discovery; `PlatformOverviewPage`
    source moved from portal-app
  - `@openchoreo/backstage-plugin-react` — `useQueryParams` (backwards-compat
    re-export left in `@openchoreo/backstage-plugin`)

- 36f0982: Surface the deployed OpenChoreo platform version in the Console. The backend
  gains a `GET /platform-version` route proxying the OpenChoreo API server's
  public `/version` endpoint; the frontend gains `getPlatformVersion()` on the
  client and a `PlatformAboutCard` component. The stock portal shows the card
  in Settings → General next to the stock user-settings cards.
- d7f12e6: Restore the Portal Assistant surfaces that were dropped in the New Frontend
  System entity-page migration.

  Introduce a decoupled assistant-integration contract in
  `@openchoreo/backstage-plugin-react` (`portalAssistantIntegrationApiRef`,
  `usePortalAssistant`, `BuildFailureNotifierSlot`) so no plugin depends on the
  private portal-assistant plugin. The OpenChoreo plugins consume it: the
  component Overview layout and the Workflows (Build) page mount
  `BuildFailureNotifierSlot`, and the deploy panel (`Environments`) falls back
  to the contract's `renderInvestigateAction` slot when mounted propless.

  The portal app registers the provider for these slots (the composition root
  owns the portal-assistant dependency), wiring the failed-build launcher and
  the deploy-panel "Investigate with AI" action back in. With the assistant
  feature enabled, the failed-build prompt reappears on the Overview and Build
  tabs and the investigate action on a pending/failed deployment. When no
  assistant is registered every slot renders nothing.

- 0c85b6b: Render trait configuration forms using `x-openchoreo-backstage-portal` schema annotations. The Add/Edit trait dialogs now fold these vendor extensions (e.g. `ui:order`, `ui:widget`, `ui:title`, `ui:placeholder`) into the RJSF uiSchema, letting trait authors control form rendering. Traits without annotations are unaffected.

### Patch Changes

- c2acee5: Support frameless rendering for widgets embedded in a home page card. `SummaryWidgetWrapper` gains a `disableCard` prop and `MyProjectsWidget` forwards it; `QuickActionsSection` gains a `hideTitle` prop. These let the components render body-only content when an outer card extension already provides the card frame and title, avoiding duplicated headers.
- cc2fe12: Publish `@openchoreo/*` to the public npm registry instead of GitHub Packages. Installing the plugins no longer requires a GitHub personal access token or any registry configuration. Releases are published from CI via npm trusted publishing (OIDC), so every version from this release onward carries a signed provenance attestation.
- 23f804a: Render `<resource:name>` entity tags in RCA reports as catalog links, instead
  of dropping them as unknown HTML along with the resource name. Clamp resource
  parameter values to three lines, so a long value no longer stretches every
  card in the overview row.
- Updated dependencies [f39a20c]
- Updated dependencies [4c7f96c]
- Updated dependencies [526e7ac]
- Updated dependencies [202d582]
- Updated dependencies [d00d48b]
- Updated dependencies [45caff4]
- Updated dependencies [a958b80]
- Updated dependencies [c2acee5]
- Updated dependencies [67ba0da]
- Updated dependencies [497b480]
- Updated dependencies [ce31a0e]
- Updated dependencies [762b22a]
- Updated dependencies [0a7d538]
- Updated dependencies [d7f12e6]
  - @openchoreo/backstage-design-system@1.3.0-next.0
  - @openchoreo/backstage-plugin-common@1.3.0-next.0
  - @openchoreo/backstage-plugin-react@1.3.0-next.0
  - @openchoreo/cell-diagram@1.3.0-next.0

## 1.2.0

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

  Switching the catalog Kind filter now reflects the newly selected kind
  immediately: a cached kind's rows and title appear at once from the cache, and
  an uncached kind shows a clean full-page loader under the new kind's title
  instead of leaving the previous kind's rows on screen until the fetch resolves.

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
- e809b2d: Limit the condition action selector to actions compatible with the current selection, so only actions sharing a condition attribute are offered.
- d5eff9e: Use the standard Backstage `EmptyState` for the Deploy tab's empty and error states (Component, Project, and Resource), matching the look of other empty states in the app (e.g. "Workflows Not Available" on the Build tab). Replaces the card + custom message + Retry button with a title + description empty state, and the "no environments" state now links to the project's deployment pipeline so it can be reviewed/configured.
- f1163a9: Fix the Deploy views defaulting to every environment in the namespace when a project's deployment pipeline defines no environments. A resolved pipeline with no promotion paths now yields no environments (the UI shows its empty state), and a pipeline that cannot be resolved (missing `deploymentPipelineRef` or a failed pipeline fetch) surfaces an error state instead of silently listing all environments.

  A permission denial on the deployment-pipeline read (`deploymentpipelines:view`) now surfaces as a Forbidden state instead of a misleading "pipeline missing/misconfigured" error.

  The Component, Project, and Resource Deploy tabs now share the same empty-state and error-state cards (icon, message, and Retry) with consistent, pipeline-focused copy, replacing the plain text lines previously shown on the Project and Resource tabs.

- c7c41b7: Disable the primary action (Create Release / Save Overrides / Deploy) on
  the deploy flow while an environment variable or file mount row is in
  edit mode, so users can't submit a half-typed row with an empty key or
  value.
- 0d2433f: Fix sidebar section separators rendering as dark near-black lines in production
  builds. The softening rule targeted the divider by its `BackstageSidebarDivider-root`
  class prefix, which JSS mangles away in the production bundle; it now targets the
  sidebar-nav `hr` element directly, so the light-mode divider stays a subtle grey in
  both dev and prod.
- b52e578: Fix cached catalog data not refreshing after a change. Creating a component or project
  left the project contents table, the namespace projects card and the catalog list showing
  the previous contents until you navigated away and back. Cached catalog reads are now
  refreshed before they are handed to the page, and the namespace cards update in place when
  newer data arrives.
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
- 52396b0: Show container names in the resource-tree pod logs tab and add a per-container
  filter. The pod logs API now returns logs aggregated across all of a pod's
  containers, each entry tagged with its container. For multi-container pods
  (for example an app container plus a Dapr sidecar) the logs viewer aligns
  each line into timestamp / container / message columns and adds a container
  dropdown ("All containers" plus one entry per container) to filter the view.
  Single-container pods are unchanged.
- 4d7ebff: Add a Refresh action to the Project Contents card and back it with the response
  cache.

  A Refresh icon button next to the "Project Contents" title re-pulls the table
  rows (and their per-environment deployment status) together with the count badge
  and type-filter options. `useProjectContentsPage` moves off a hand-rolled
  `useEffect` fetch onto `useOpenChoreoQuery`, split into two dependent queries
  (page rows + visible-row deployment bindings), so it gains `refetch`/
  `isRefetching` and smoother paging. The card also reserves a full page's height
  so navigating to a shorter last page no longer makes the widget jump.

  `useOpenChoreoQuery` gains an optional `keepPreviousData` flag (forwarded as
  `placeholderData: keepPreviousData`) so paginated queries can keep the previous
  page on screen while the next one loads. It is additive and only applied when
  set, so existing callers are unchanged.

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

- 84cfaeb: Auto-select a default card in the Environments deploy graph instead of
  landing users on an empty detail panel: first env with an active or
  pending deployment, else the first failed env, else the first undeployed
  env, falling back to the Setup card when only never-deployed envs exist.
  Only applies while nothing is selected, so it never overrides a manual
  choice.
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

- c6f1de1: Rework the Environments setup card auto-deploy experience: searchable
  release dropdown with a primary "New release" CTA, an empty-state
  panel for brand-new components, an optimistic auto-deploy toggle with
  inline "Saving…" feedback and permission-aware error handling, and a
  controller-truth "Last deployed release" row that polls for the new
  release after a save.
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

- 8d8bd80: Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

  This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

  Notable adapter-side changes:

  - Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
  - Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
  - The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
  - React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.

- Updated dependencies [591df85]
- Updated dependencies [c86de7f]
- Updated dependencies [18e51cf]
- Updated dependencies [436c144]
- Updated dependencies [62608f5]
- Updated dependencies [529f13c]
- Updated dependencies [cf2203a]
- Updated dependencies [8381554]
- Updated dependencies [39d264c]
- Updated dependencies [0d2433f]
- Updated dependencies [8381554]
- Updated dependencies [b52e578]
- Updated dependencies [e3986a9]
- Updated dependencies [383e7f6]
- Updated dependencies [d5eff9e]
- Updated dependencies [4d7ebff]
- Updated dependencies [8416223]
- Updated dependencies [71f7b6c]
- Updated dependencies [2f45e83]
- Updated dependencies [14601f4]
- Updated dependencies [1207eda]
- Updated dependencies [7c76d05]
- Updated dependencies [591df85]
- Updated dependencies [915e2e5]
- Updated dependencies [284fcd7]
- Updated dependencies [453b958]
- Updated dependencies [c572a46]
- Updated dependencies [8d8bd80]
- Updated dependencies [d19ffcf]
  - @openchoreo/backstage-design-system@1.2.0
  - @openchoreo/backstage-plugin-react@1.2.0
  - @openchoreo/backstage-plugin-common@1.2.0
  - @openchoreo/cell-diagram@1.2.0

## 1.2.0-next.2

### Patch Changes

- b52e578: Fix cached catalog data not refreshing after a change. Creating a component or project
  left the project contents table, the namespace projects card and the catalog list showing
  the previous contents until you navigated away and back. Cached catalog reads are now
  refreshed before they are handed to the page, and the namespace cards update in place when
  newer data arrives.
- 52396b0: Show container names in the resource-tree pod logs tab and add a per-container
  filter. The pod logs API now returns logs aggregated across all of a pod's
  containers, each entry tagged with its container. For multi-container pods
  (for example an app container plus a Dapr sidecar) the logs viewer aligns
  each line into timestamp / container / message columns and adds a container
  dropdown ("All containers" plus one entry per container) to filter the view.
  Single-container pods are unchanged.
- 4d7ebff: Add a Refresh action to the Project Contents card and back it with the response
  cache.

  A Refresh icon button next to the "Project Contents" title re-pulls the table
  rows (and their per-environment deployment status) together with the count badge
  and type-filter options. `useProjectContentsPage` moves off a hand-rolled
  `useEffect` fetch onto `useOpenChoreoQuery`, split into two dependent queries
  (page rows + visible-row deployment bindings), so it gains `refetch`/
  `isRefetching` and smoother paging. The card also reserves a full page's height
  so navigating to a shorter last page no longer makes the widget jump.

  `useOpenChoreoQuery` gains an optional `keepPreviousData` flag (forwarded as
  `placeholderData: keepPreviousData`) so paginated queries can keep the previous
  page on screen while the next one loads. It is additive and only applied when
  set, so existing callers are unchanged.

- Updated dependencies [b52e578]
- Updated dependencies [4d7ebff]
  - @openchoreo/backstage-plugin-react@1.2.0-next.2
  - @openchoreo/backstage-plugin-common@1.2.0-next.2

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
