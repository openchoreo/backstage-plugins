---
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-backend': patch
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-plugin-common': patch
'@openchoreo/backstage-plugin-catalog-backend-module': patch
'@openchoreo/backstage-plugin-scaffolder-backend-module': patch
'@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy': patch
'@openchoreo/openchoreo-client-node': patch
---

Add Backstage catalog and UI support for the new OpenChoreo `ProjectType` (namespaced) and `ClusterProjectType` (cluster-scoped) platform-engineer abstractions introduced by the project-release-lifecycle epic.

The catalog provider now ingests both kinds (full sync and near-real-time event deltas), translates them into dedicated entity kinds, and links each `Project` to the `ProjectType` / `ClusterProjectType` it references via `spec.type` (an `instanceOf` / `hasInstance` relation). Both kinds get first-class Overview pages — rendering their `parameters` / `environmentConfigs` schemas, `validations`, and `resources` templates — plus a Definition tab showing the raw CR, and they appear throughout the catalog UI (kind registry, icons, graph labels, About card).

Permission wiring enables create / edit / delete on both kinds for authorized users, and a scaffolder creation wizard is added for each (grouped under "Platform Resources"). The generated OpenChoreo API client is re-synced from core `main` to pick up the `ProjectType` / `ClusterProjectType` schemas, their REST endpoints, and the new `Project.spec.type` field.
