# @openchoreo/backstage-plugin

## 1.1.2

### Patch Changes

- 79b8925: Use the standard Backstage `EmptyState` for the Deploy tab's empty and error states (Component, Project, and Resource), matching the look of other empty states in the app (e.g. "Workflows Not Available" on the Build tab). Replaces the card + custom message + Retry button with a title + description empty state, and the "no environments" state now links to the project's deployment pipeline so it can be reviewed/configured.
- 79b8925: Fix the Deploy views defaulting to every environment in the namespace when a project's deployment pipeline defines no environments. A resolved pipeline with no promotion paths now yields no environments (the UI shows its empty state), and a pipeline that cannot be resolved (missing `deploymentPipelineRef` or a failed pipeline fetch) surfaces an error state instead of silently listing all environments.

  A permission denial on the deployment-pipeline read (`deploymentpipelines:view`) now surfaces as a Forbidden state instead of a misleading "pipeline missing/misconfigured" error.

  The Component, Project, and Resource Deploy tabs now share the same empty-state and error-state cards (icon, message, and Retry) with consistent, pipeline-focused copy, replacing the plain text lines previously shown on the Project and Resource tabs.

## 1.1.1

- Display resource entities in the project overview page. (#590)
- Runtime network observability toggle added to the cell diagram. (#578)
- Resource Deploy actions gated on environment-scoped permissions. (#577)

## 1.1.0

- Initial public release on GitHub Packages, aligned with the OpenChoreo platform release line (`1.1.0`).
