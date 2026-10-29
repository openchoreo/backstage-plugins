# @openchoreo/backstage-plugin-backend

## 1.4.0-m.1

### Minor Changes

- f5ca212: Notification channels read their secret values from SecretReferences. The create form picks
  SMTP credentials and webhook header secrets from the namespace's SecretReferences (those with no
  target plane or targeting an observability plane), with a key dropdown, instead of free-text
  Kubernetes Secret names. The channel's overview card shows its secret references with their keys,
  its Ready status, and a warning when it still copies values from Kubernetes Secrets, which is
  deprecated. The Secrets page can create secrets in an `ObservabilityPlane` or
  `ClusterObservabilityPlane` secret store, and the client is regenerated for the observability
  plane `secretStoreRef`, the new target plane kinds and the channel status conditions.
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
- Updated dependencies [acc4c81]
- Updated dependencies [9e3a840]
- Updated dependencies [f5ca212]
- Updated dependencies [44795b9]
- Updated dependencies [c67978a]
- Updated dependencies [cdc4c6e]
  - @openchoreo/backstage-plugin-catalog-backend-module@2.0.0-next.0
  - @openchoreo/backstage-plugin-common@2.0.0-next.0
  - @openchoreo/openchoreo-client-node@2.0.0-next.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@2.0.0-next.0
  - @openchoreo/openchoreo-auth@2.0.0-next.0
  - @openchoreo/cell-diagram@2.0.0-next.0

## 1.3.0

### Minor Changes

- 36f0982: Surface the deployed OpenChoreo platform version in the Console. The backend
  gains a `GET /platform-version` route proxying the OpenChoreo API server's
  public `/version` endpoint; the frontend gains `getPlatformVersion()` on the
  client and a `PlatformAboutCard` component. The stock portal shows the card
  in Settings → General next to the stock user-settings cards.

### Patch Changes

- 4278619: Treat ReleaseBinding Ready reasons `ReleaseSynced`, `ResourceDependenciesPending`,
  and `ResourcesNotReady` as progressing (NotReady) instead of Failed.
- eb94bf1: Fix Deploy UI showing Failed for ProjectReleaseBinding during namespace provisioning
- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [c234b33]
- Updated dependencies [a958b80]
- Updated dependencies [497b480]
- Updated dependencies [ce31a0e]
- Updated dependencies [0a7d538]
- Updated dependencies [67ba0da]
- Updated dependencies [9eb3d31]
- Updated dependencies [435463f]
  - @openchoreo/backstage-plugin-common@1.3.0
  - @openchoreo/openchoreo-client-node@1.3.0
  - @openchoreo/cell-diagram@1.3.0
  - @openchoreo/backstage-plugin-catalog-backend-module@1.3.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.3.0
  - @openchoreo/openchoreo-auth@1.3.0

## 1.3.0-next.0

### Minor Changes

- 36f0982: Surface the deployed OpenChoreo platform version in the Console. The backend
  gains a `GET /platform-version` route proxying the OpenChoreo API server's
  public `/version` endpoint; the frontend gains `getPlatformVersion()` on the
  client and a `PlatformAboutCard` component. The stock portal shows the card
  in Settings → General next to the stock user-settings cards.

### Patch Changes

- 4278619: Treat ReleaseBinding Ready reasons `ReleaseSynced`, `ResourceDependenciesPending`,
  and `ResourcesNotReady` as progressing (NotReady) instead of Failed.
- eb94bf1: Fix Deploy UI showing Failed for ProjectReleaseBinding during namespace provisioning
- Updated dependencies [4c7f96c]
- Updated dependencies [a3e7d3f]
- Updated dependencies [c234b33]
- Updated dependencies [a958b80]
- Updated dependencies [497b480]
- Updated dependencies [ce31a0e]
- Updated dependencies [0a7d538]
- Updated dependencies [67ba0da]
- Updated dependencies [9eb3d31]
- Updated dependencies [435463f]
  - @openchoreo/backstage-plugin-common@1.3.0-next.0
  - @openchoreo/openchoreo-client-node@1.3.0-next.0
  - @openchoreo/cell-diagram@1.3.0-next.0
  - @openchoreo/backstage-plugin-catalog-backend-module@1.3.0-next.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.3.0-next.0

## 1.2.0

### Minor Changes

- f126bca: Block deploying a component to an environment where its project is not deployed, and guide the user to deploy the project first.
- cf2203a: Add a pod-aware exec terminal in the Deploy view. The Terminal lives in the K8s resource-tree drawer reached via Deploy → environment → View K8s Artifacts: it appears as a tab on the Pod node's drawer (with a container picker) when the pod is rendered in the tree, and falls back to the ReleaseBinding drawer when the pod is managed by another operator and the binding is healthy. The exec session targets the selected pod and container via WebSocket. The standalone component-level Terminal tab has been removed.

  Access is gated by the `openchoreo.exec` permission with per-environment ABAC, and the `POST /exec/init` backend endpoint now enforces this permission server-side so direct API calls cannot bypass the UI gate.

- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 284fcd7: Surface OpenChoreo controller auto-deploy failures in the Deploy tab. Pre-binding release-generation failures (bad trait, invalid config — from `Component.status.conditions`) now surface on the Setup card and as an error marker on the canvas Set-up tile, instead of leaving the user with no signal. Post-binding render/apply failures (from `ReleaseBinding.status.conditions`) show an actionable error banner with the controller's reason + message in the environment detail panel, instead of a context-free "Failed" badge. Long controller messages are clamped to a compact banner with a "View details" dialog (reason + full message + copy).
- 453b958: Show a "Suspended" status in the deployment pipeline when a component's workload is scaled to zero. The backend reads the suspended state that core already reports on the ReleaseBinding's ResourcesReady condition, and the pipeline badge now shows "Suspended" instead of "Active" for a scaled-to-zero workload.

### Patch Changes

- 436c144: Bring the Cell Diagram library into the repo as the internal package
  `@openchoreo/cell-diagram` (previously the external `@wso2/cell-diagram`). The
  exported API is unchanged; the frontend and backend plugins now consume the
  workspace package.
- 62608f5: chore: remove dead code left over from the OpenAPI-client and New Frontend
  System migrations — commented-out blocks, orphaned files/components, and unused
  deprecated exports (`LogEntry`/`RuntimeLogsResponse` aliases, `FILTER_PRESETS`,
  `useOrgName`, `useRCAReportByAlert`, `UserTypeConfig`), plus consolidation of
  duplicated backend response-type wrappers. No behavioural changes.
- f1163a9: Fix the Deploy views defaulting to every environment in the namespace when a project's deployment pipeline defines no environments. A resolved pipeline with no promotion paths now yields no environments (the UI shows its empty state), and a pipeline that cannot be resolved (missing `deploymentPipelineRef` or a failed pipeline fetch) surfaces an error state instead of silently listing all environments.

  A permission denial on the deployment-pipeline read (`deploymentpipelines:view`) now surfaces as a Forbidden state instead of a misleading "pipeline missing/misconfigured" error.

  The Component, Project, and Resource Deploy tabs now share the same empty-state and error-state cards (icon, message, and Retry) with consistent, pipeline-focused copy, replacing the plain text lines previously shown on the Project and Resource tabs.

- 6b82eae: Update stale code comments that referenced the exec WebSocket proxy's old location (`packages/backend/src/index.ts`); it now lives in and is registered from the `@openchoreo/backstage-plugin-backend` plugin.
- e79c7b3: Prefer HTTPS over HTTP for endpoint URLs surfaced in the API test console. When
  a ReleaseBinding endpoint exposes both an `http` and an `https` URL, the console
  could show either one, since the frontend selects the first entry of each URL
  map and is otherwise scheme-blind — which URL came first was decided by the
  upstream control-plane response ordering. The `ReleaseBinding` transformer now
  reorders each endpoint's `externalURLs`/`internalURLs` so `https` entries come
  first (relative order otherwise preserved), making the existing frontend
  selection land on the secure URL with no frontend change. http-only endpoints
  and endpoints without URL maps are unaffected.
- d5eff9e: Replace the generic "No environments found. Make sure your component is properly configured." message on the observability pages (Runtime Logs, Runtime Events, Alerts, Wirelogs, Metrics, Traces, Incidents, Cost Analysis, RCA — component and project scoped) with cause-specific messaging. `useProjectEnvironments` now reports a discriminated status — `empty-pipeline` (the deployment pipeline has no environments), `forbidden` (permission to view the pipeline is denied), or `unavailable` (the pipeline is missing or couldn't be loaded) — and the pages render a cause-specific state via a shared `EnvironmentsStatusNotice` component, using the standard Backstage `EmptyState` (matching the Deploy tab). A missing `deploymentPipelineRef` now returns a clean 404 instead of a 500.
- 14f1052: Add a default-on Auto Deploy toggle to the project creation wizard. When on, `openchoreo:project:create` creates one unpinned ProjectReleaseBinding per deployment-pipeline environment after the project is created, and the control plane seeds the release pin once the first release is cut. Toggling it off shows a warning that the project must be deployed manually from its Deploy tab before components can be deployed. The Deploy tab now shows just-created unpinned bindings (`ProjectReleaseNotSet`) as pending instead of failed.
- 71f7b6c: Add a "Deploy" tab to the Project entity page for the project-release lifecycle.

  The tab renders the project's deployment pipeline as a DAG of environments with live status and drives deploy/promote through `ProjectRelease` / `ProjectReleaseBinding`. A "Set up" card opens a **Configure & Deploy** wizard: step 1 edits `Project.spec.parameters` against the `(Cluster)ProjectType` parameters schema (saving cuts a new `ProjectRelease`), step 2 pins the first environment's binding and edits its `environmentConfigs` overrides. Each environment node supports **Promote** (copy the pinned release forward to the next environment) and **Configure overrides**; all mutating actions gate on the project-update permission.

  Backed by new BFF endpoints (`/project-environment-info`, `/project-release-bindings`, `/update-project-release-binding`, `/project-release-schema`) and matching `OpenChoreoClient` methods.

- 2f45e83: Add Backstage catalog and UI support for the new OpenChoreo `ProjectType` (namespaced) and `ClusterProjectType` (cluster-scoped) platform-engineer abstractions introduced by the project-release-lifecycle epic.

  The catalog provider now ingests both kinds (full sync and near-real-time event deltas), translates them into dedicated entity kinds, and links each `Project` to the `ProjectType` / `ClusterProjectType` it references via `spec.type` (an `instanceOf` / `hasInstance` relation). Both kinds get first-class Overview pages — rendering their `parameters` / `environmentConfigs` schemas, `validations`, and `resources` templates — plus a Definition tab showing the raw CR, and they appear throughout the catalog UI (kind registry, icons, graph labels, About card).

  Permission wiring enables create / edit / delete on both kinds for authorized users, and a scaffolder creation wizard is added for each (grouped under "Platform Resources"). The generated OpenChoreo API client is re-synced from core `main` to pick up the `ProjectType` / `ClusterProjectType` schemas, their REST endpoints, and the new `Project.spec.type` field.

- 5741d00: Limit how long a wirelogs stream can run. Wirelogs (Cilium Hubble flows) previously streamed indefinitely — there's no upstream timeout, so a forgotten tab could hold an open SSE connection for hours and degrade the browser.

  The backend `/wirelogs/stream` proxy now enforces a hard cap (default 15 minutes, configurable via `openchoreo.observability.wirelogs.streamTimeoutSeconds`): it advertises the cap to the client in a `meta` SSE frame and, on hitting it, sends a `timeout` frame before closing so the UI can label the stop precisely. The wirelogs view layers graduated soft warnings over this — confirmation dialogs at roughly one-third and two-thirds of the cap let the user stop early or knowingly continue, and a toast explains when the server ends the stream (the Start button resumes a fresh session).

- Updated dependencies [ffa762f]
- Updated dependencies [18e51cf]
- Updated dependencies [436c144]
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
- Updated dependencies [1207eda]
- Updated dependencies [284fcd7]
- Updated dependencies [56b4e95]
- Updated dependencies [8d8bd80]
- Updated dependencies [d19ffcf]
  - @openchoreo/backstage-plugin-catalog-backend-module@1.2.0
  - @openchoreo/backstage-plugin-common@1.2.0
  - @openchoreo/cell-diagram@1.2.0
  - @openchoreo/openchoreo-client-node@1.2.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.2.0
  - @openchoreo/openchoreo-auth@1.2.0

## 1.2.0-next.2

### Patch Changes

- e79c7b3: Prefer HTTPS over HTTP for endpoint URLs surfaced in the API test console. When
  a ReleaseBinding endpoint exposes both an `http` and an `https` URL, the console
  could show either one, since the frontend selects the first entry of each URL
  map and is otherwise scheme-blind — which URL came first was decided by the
  upstream control-plane response ordering. The `ReleaseBinding` transformer now
  reorders each endpoint's `externalURLs`/`internalURLs` so `https` entries come
  first (relative order otherwise preserved), making the existing frontend
  selection land on the secure URL with no frontend change. http-only endpoints
  and endpoints without URL maps are unaffected.
- Updated dependencies [52396b0]
- Updated dependencies [56b4e95]
  - @openchoreo/openchoreo-client-node@1.2.0-next.2
  - @openchoreo/backstage-plugin-catalog-backend-module@1.2.0-next.2
  - @openchoreo/backstage-plugin-common@1.2.0-next.2
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.2.0-next.2

## 1.2.0-next.3

### Minor Changes

- f126bca: Block deploying a component to an environment where its project is not deployed, and guide the user to deploy the project first.
- cf2203a: Add a pod-aware exec terminal in the Deploy view. The Terminal lives in the K8s resource-tree drawer reached via Deploy → environment → View K8s Artifacts: it appears as a tab on the Pod node's drawer (with a container picker) when the pod is rendered in the tree, and falls back to the ReleaseBinding drawer when the pod is managed by another operator and the binding is healthy. The exec session targets the selected pod and container via WebSocket. The standalone component-level Terminal tab has been removed.

  Access is gated by the `openchoreo.exec` permission with per-environment ABAC, and the `POST /exec/init` backend endpoint now enforces this permission server-side so direct API calls cannot bypass the UI gate.

- 383e7f6: Add Backstage management for OpenChoreo notification channels (email and webhook), the platform resource that alert rules send notifications to. Notification channels are now browsable and creatable from the catalog and /create pages alongside Environments and other platform resources, with dedicated create/read/update/delete permissions, a catalog relation to their target Environment, and a raw-definition editor.
- 284fcd7: Surface OpenChoreo controller auto-deploy failures in the Deploy tab. Pre-binding release-generation failures (bad trait, invalid config — from `Component.status.conditions`) now surface on the Setup card and as an error marker on the canvas Set-up tile, instead of leaving the user with no signal. Post-binding render/apply failures (from `ReleaseBinding.status.conditions`) show an actionable error banner with the controller's reason + message in the environment detail panel, instead of a context-free "Failed" badge. Long controller messages are clamped to a compact banner with a "View details" dialog (reason + full message + copy).
- 453b958: Show a "Suspended" status in the deployment pipeline when a component's workload is scaled to zero. The backend reads the suspended state that core already reports on the ReleaseBinding's ResourcesReady condition, and the pipeline badge now shows "Suspended" instead of "Active" for a scaled-to-zero workload.

### Patch Changes

- 436c144: Bring the Cell Diagram library into the repo as the internal package
  `@openchoreo/cell-diagram` (previously the external `@wso2/cell-diagram`). The
  exported API is unchanged; the frontend and backend plugins now consume the
  workspace package.
- 62608f5: chore: remove dead code left over from the OpenAPI-client and New Frontend
  System migrations — commented-out blocks, orphaned files/components, and unused
  deprecated exports (`LogEntry`/`RuntimeLogsResponse` aliases, `FILTER_PRESETS`,
  `useOrgName`, `useRCAReportByAlert`, `UserTypeConfig`), plus consolidation of
  duplicated backend response-type wrappers. No behavioural changes.
- f1163a9: Fix the Deploy views defaulting to every environment in the namespace when a project's deployment pipeline defines no environments. A resolved pipeline with no promotion paths now yields no environments (the UI shows its empty state), and a pipeline that cannot be resolved (missing `deploymentPipelineRef` or a failed pipeline fetch) surfaces an error state instead of silently listing all environments.

  A permission denial on the deployment-pipeline read (`deploymentpipelines:view`) now surfaces as a Forbidden state instead of a misleading "pipeline missing/misconfigured" error.

  The Component, Project, and Resource Deploy tabs now share the same empty-state and error-state cards (icon, message, and Retry) with consistent, pipeline-focused copy, replacing the plain text lines previously shown on the Project and Resource tabs.

- 6b82eae: Update stale code comments that referenced the exec WebSocket proxy's old location (`packages/backend/src/index.ts`); it now lives in and is registered from the `@openchoreo/backstage-plugin-backend` plugin.
- d5eff9e: Replace the generic "No environments found. Make sure your component is properly configured." message on the observability pages (Runtime Logs, Runtime Events, Alerts, Wirelogs, Metrics, Traces, Incidents, Cost Analysis, RCA — component and project scoped) with cause-specific messaging. `useProjectEnvironments` now reports a discriminated status — `empty-pipeline` (the deployment pipeline has no environments), `forbidden` (permission to view the pipeline is denied), or `unavailable` (the pipeline is missing or couldn't be loaded) — and the pages render a cause-specific state via a shared `EnvironmentsStatusNotice` component, using the standard Backstage `EmptyState` (matching the Deploy tab). A missing `deploymentPipelineRef` now returns a clean 404 instead of a 500.
- 14f1052: Add a default-on Auto Deploy toggle to the project creation wizard. When on, `openchoreo:project:create` creates one unpinned ProjectReleaseBinding per deployment-pipeline environment after the project is created, and the control plane seeds the release pin once the first release is cut. Toggling it off shows a warning that the project must be deployed manually from its Deploy tab before components can be deployed. The Deploy tab now shows just-created unpinned bindings (`ProjectReleaseNotSet`) as pending instead of failed.
- 71f7b6c: Add a "Deploy" tab to the Project entity page for the project-release lifecycle.

  The tab renders the project's deployment pipeline as a DAG of environments with live status and drives deploy/promote through `ProjectRelease` / `ProjectReleaseBinding`. A "Set up" card opens a **Configure & Deploy** wizard: step 1 edits `Project.spec.parameters` against the `(Cluster)ProjectType` parameters schema (saving cuts a new `ProjectRelease`), step 2 pins the first environment's binding and edits its `environmentConfigs` overrides. Each environment node supports **Promote** (copy the pinned release forward to the next environment) and **Configure overrides**; all mutating actions gate on the project-update permission.

  Backed by new BFF endpoints (`/project-environment-info`, `/project-release-bindings`, `/update-project-release-binding`, `/project-release-schema`) and matching `OpenChoreoClient` methods.

- 2f45e83: Add Backstage catalog and UI support for the new OpenChoreo `ProjectType` (namespaced) and `ClusterProjectType` (cluster-scoped) platform-engineer abstractions introduced by the project-release-lifecycle epic.

  The catalog provider now ingests both kinds (full sync and near-real-time event deltas), translates them into dedicated entity kinds, and links each `Project` to the `ProjectType` / `ClusterProjectType` it references via `spec.type` (an `instanceOf` / `hasInstance` relation). Both kinds get first-class Overview pages — rendering their `parameters` / `environmentConfigs` schemas, `validations`, and `resources` templates — plus a Definition tab showing the raw CR, and they appear throughout the catalog UI (kind registry, icons, graph labels, About card).

  Permission wiring enables create / edit / delete on both kinds for authorized users, and a scaffolder creation wizard is added for each (grouped under "Platform Resources"). The generated OpenChoreo API client is re-synced from core `main` to pick up the `ProjectType` / `ClusterProjectType` schemas, their REST endpoints, and the new `Project.spec.type` field.

- 5741d00: Limit how long a wirelogs stream can run. Wirelogs (Cilium Hubble flows) previously streamed indefinitely — there's no upstream timeout, so a forgotten tab could hold an open SSE connection for hours and degrade the browser.

  The backend `/wirelogs/stream` proxy now enforces a hard cap (default 15 minutes, configurable via `openchoreo.observability.wirelogs.streamTimeoutSeconds`): it advertises the cap to the client in a `meta` SSE frame and, on hitting it, sends a `timeout` frame before closing so the UI can label the stop precisely. The wirelogs view layers graduated soft warnings over this — confirmation dialogs at roughly one-third and two-thirds of the cap let the user stop early or knowingly continue, and a toast explains when the server ends the stream (the Start button resumes a fresh session).

- Updated dependencies [18e51cf]
- Updated dependencies [436c144]
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
  - @openchoreo/cell-diagram@1.2.0-next.3
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.2.0-next.3
  - @openchoreo/openchoreo-client-node@1.2.0-next.3

## 1.2.0-next.0

### Patch Changes

- Updated dependencies [ffa762f]
- Updated dependencies [529f13c]
- Updated dependencies [1207eda]
- Updated dependencies [8d8bd80]
  - @openchoreo/backstage-plugin-catalog-backend-module@1.2.0-next.0
  - @openchoreo/backstage-plugin-common@1.2.0-next.0
  - @openchoreo/openchoreo-client-node@1.2.0-next.0
  - @openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy@1.2.0-next.0
  - @openchoreo/openchoreo-auth@1.2.0-next.0

## 1.1.1

- Backend support for the runtime network observability toggle in the cell diagram. (#578)

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
