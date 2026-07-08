---
'@openchoreo/backstage-plugin-backend': patch
'@openchoreo/backstage-plugin': patch
---

Fix the Deploy views defaulting to every environment in the namespace when a project's deployment pipeline defines no environments. A resolved pipeline with no promotion paths now yields no environments (the UI shows its empty state), and a pipeline that cannot be resolved (missing `deploymentPipelineRef` or a failed pipeline fetch) surfaces an error state instead of silently listing all environments.

A permission denial on the deployment-pipeline read (`deploymentpipelines:view`) now surfaces as a Forbidden state instead of a misleading "pipeline missing/misconfigured" error.

The Component, Project, and Resource Deploy tabs now share the same empty-state and error-state cards (icon, message, and Retry) with consistent, pipeline-focused copy, replacing the plain text lines previously shown on the Project and Resource tabs.
