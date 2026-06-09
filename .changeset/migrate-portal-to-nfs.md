---
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
'@openchoreo/backstage-plugin-platform-engineer-core': patch
---

Add an `/alpha` entry point that exposes each plugin as a `createFrontendPlugin` for use with Backstage's New Frontend System (NFS). The default entry continues to export the legacy `createPlugin` instance so existing host apps keep working unchanged; adopters on NFS can now import `from '@openchoreo/backstage-plugin-<name>/alpha'` and include the plugin directly in `createApp({ features: [...] })`.

The `/alpha` exports register each plugin's API factories (e.g. `openChoreoCiClientApiRef`, `genericWorkflowsClientApiRef`, the three observability backend clients, `openChoreoClientApiRef`) and one top-level page where applicable (`platform-engineer-core`'s dashboard view, `openchoreo-workflows`' generic workflows page, `openchoreo-ci`'s workflows entity tab). Entity tabs and component cards that the host app mounts with per-call props (e.g. `<ObservabilityRuntimeLogs renderRowAction={...} />`) remain on the legacy export for now; a future release will move those host-injected callables behind a registry API so they can ride through NFS extensions too.

This addresses the body of [openchoreo/openchoreo#3568](https://github.com/openchoreo/openchoreo/issues/3568) — adopters can drop `--legacy` from the `@backstage/create-app` step when installing the plugin suite into an existing Backstage host.
