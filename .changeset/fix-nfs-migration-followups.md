---
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
'@openchoreo/backstage-plugin-react': patch
---

Follow-up fixes to the New Frontend System (NFS) migration.

Custom catalog-graph relations, entity-presentation kind icons, and the
scaffolder form-decorator override are now actually applied at runtime —
the original NFS migration registered them but they were silently
overwritten by upstream defaults at startup. The form-decorator override
also stops dropping decorators contributed by other plugins.

Entity tabs and overview cards that previously lived in the host's
`EntityPage.tsx` now ride through each plugin's `/alpha` export as
`EntityContentBlueprint` and `EntityCardBlueprint` extensions, with the
right kind filters. Adopters on `/alpha` get the full entity-page
contributions automatically: the OpenChoreo CI plugin contributes the
Build tab (scoped to `kind:component`); the observability plugin
contributes the 10 component- and system-page tabs (Logs, Events,
Metrics, Alerts, Wirelogs, Traces, Incidents, RCA Reports, Cost
Analysis) plus a registry API for host-injected log-row action renderers;
the OpenChoreo plugin contributes the Deploy tab, the system Cell
Diagram tab, the shared Resource Definition tab, and 30+ overview cards
spanning every OpenChoreo platform kind (Environment, DataPlane,
WorkflowPlane, ObservabilityPlane, DeploymentPipeline, the ComponentType
/ ResourceType / TraitType families, and the Workflow family); the
generic-workflows plugin contributes the Runs tab on `Workflow` and
`ClusterWorkflow` entities of type `Generic`. The react plugin exposes a
new `FeatureGatedContent` component so plugin authors can gate routable
extensions on the OpenChoreo feature flags without rolling their own
empty-state wrapper.

Adopters still on the default (legacy) export are unaffected.
