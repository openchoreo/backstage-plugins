---
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
'@openchoreo/backstage-plugin-platform-engineer-core': patch
'@openchoreo/backstage-plugin-react': patch
---

Add an `/alpha` entry point that exposes each plugin as a `createFrontendPlugin` for use with Backstage's New Frontend System (NFS). The default entry continues to export the legacy `createPlugin` instance so existing host apps keep working unchanged; adopters on NFS can now import `from '@openchoreo/backstage-plugin-<name>/alpha'` and include the plugin directly in `createApp({ features: [...] })`.

The `/alpha` exports register each plugin's API factories (e.g. `openChoreoCiClientApiRef`, `genericWorkflowsClientApiRef`, the three observability backend clients, `openChoreoClientApiRef`) and one top-level page where applicable (`platform-engineer-core`'s dashboard view, `openchoreo-workflows`' generic workflows page, `openchoreo-ci`'s workflows entity tab).

Entity tabs and overview cards that previously lived in the host's `EntityPage.tsx` now ride through each plugin's `/alpha` export as `EntityContentBlueprint` and `EntityCardBlueprint` extensions, with the right kind filters. Adopters on `/alpha` get the full entity-page contributions automatically: the OpenChoreo CI plugin contributes the Build tab (scoped to `kind:component`); the observability plugin contributes the 10 component- and system-page tabs (Logs, Events, Metrics, Alerts, Wirelogs, Traces, Incidents, RCA Reports, Cost Analysis) plus a registry API for host-injected log-row action renderers; the OpenChoreo plugin contributes the Deploy tab, the system Cell Diagram tab, the shared Resource Definition tab, and 30+ overview cards spanning every OpenChoreo platform kind (Environment, DataPlane, WorkflowPlane, ObservabilityPlane, DeploymentPipeline, the ComponentType / ResourceType / TraitType families, and the Workflow family); the generic-workflows plugin contributes the Runs tab on `Workflow` and `ClusterWorkflow` entities of type `Generic`. The react plugin exposes a new `FeatureGatedContent` component so plugin authors can gate routable extensions on the OpenChoreo feature flags without rolling their own empty-state wrapper.

Custom catalog-graph relations, entity-presentation kind icons, and the scaffolder form-decorator override are now actually applied at runtime — the original migration registered them but they were silently overwritten by upstream defaults at startup. The form-decorator override also stops dropping decorators contributed by other plugins.

Adopters still on the default (legacy) export are unaffected. This addresses the body of [openchoreo/openchoreo#3568](https://github.com/openchoreo/openchoreo/issues/3568) — adopters can drop `--legacy` from the `@backstage/create-app` step when installing the plugin suite into an existing Backstage host.
