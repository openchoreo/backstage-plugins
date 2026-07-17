---
'@openchoreo/backstage-plugin-backend': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-observability-backend': patch
---

Fix the Deploy view defaulting to every environment in the namespace when a project's deployment pipeline defines no environments. A resolved pipeline with no promotion paths now yields no environments, and a pipeline that cannot be resolved (missing `deploymentPipelineRef` or a failed pipeline fetch) surfaces an error state instead of silently listing all environments. A permission denial on the deployment-pipeline read (`deploymentpipelines:view`) now surfaces as a Forbidden state instead of a misleading "pipeline missing/misconfigured" error.

Observability pages (Logs, Project Logs, Alerts, Incidents, Metrics, Traces, RCA) now scope their environment list to the project's deployment pipeline and render a Backstage `EmptyState` explaining that the pipeline has no environments configured, instead of listing every environment in the namespace or showing empty filters.
