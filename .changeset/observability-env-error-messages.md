---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-plugin-backend': patch
---

Replace the generic "No environments found. Make sure your component is properly configured." message on the observability pages (Runtime Logs, Runtime Events, Alerts, Wirelogs, Metrics, Traces, Incidents, Cost Analysis, RCA — component and project scoped) with cause-specific messaging. `useProjectEnvironments` now reports a discriminated status — `empty-pipeline` (the deployment pipeline has no environments), `forbidden` (permission to view the pipeline is denied), or `unavailable` (the pipeline is missing or couldn't be loaded) — and the pages render a cause-specific state via a shared `EnvironmentsStatusNotice` component, using the standard Backstage `EmptyState` (matching the Deploy tab). A missing `deploymentPipelineRef` now returns a clean 404 instead of a 500.
