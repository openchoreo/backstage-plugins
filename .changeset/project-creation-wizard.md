---
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-common': patch
'@openchoreo/backstage-plugin-catalog-backend-module': patch
'@openchoreo/backstage-plugin-scaffolder-backend-module': patch
---

Add a per-ProjectType "Create Project" wizard, mirroring the Resource creation flow.

Each `ProjectType` / `ClusterProjectType` now generates a scaffolder Template via `PtdToTemplateConverter`, surfaced under a new `?view=projects` browse view with a dedicated "Project" landing card. Selecting a type opens a wizard whose parameters step is driven by the type's `spec.parameters.openAPIV3Schema`, then creates the Project with `spec.type` and `spec.parameters` set via the extended `openchoreo:project:create` action (it falls back to the OpenChoreo API default when these are omitted, keeping the legacy path working). The catalog provider emits these templates during full sync and the event-delta path keeps them current. Replaces the static `create-openchoreo-project` template.
