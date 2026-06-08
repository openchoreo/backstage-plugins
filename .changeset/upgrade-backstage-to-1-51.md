---
'@openchoreo/backstage-design-system': patch
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth': patch
'@openchoreo/backstage-plugin-catalog-backend-module': patch
'@openchoreo/backstage-plugin-catalog-backend-module-openchoreo-users': patch
'@openchoreo/backstage-plugin-common': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-ci-backend': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-observability-backend': patch
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
'@openchoreo/backstage-plugin-openchoreo-workflows-backend': patch
'@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy': patch
'@openchoreo/backstage-plugin-platform-engineer-core': patch
'@openchoreo/backstage-plugin-platform-engineer-core-backend': patch
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-plugin-scaffolder-backend-module': patch
'@openchoreo/backstage-plugin-thunder-idp-client-node': patch
'@openchoreo/openapi-client-generator-node': patch
'@openchoreo/openchoreo-auth': patch
'@openchoreo/openchoreo-client-node': patch
---

Upgrade the OpenChoreo Backstage plugin suite to Backstage v1.51.0.

This bump aligns every `@backstage/*` peer dependency with the v1.51.0 line and adapts the plugins to the API shapes introduced across v1.44–v1.51. Adopters running the OpenChoreo plugins on a host Backstage app must be on Backstage v1.51.0 (or newer) after this release; older host versions will hit peer-dep mismatches.

Notable adapter-side changes:

- Scaffolder backend actions now use the v4.0 `schema.input: { field: z => z.type(...) }` field-per-arrow shape introduced after v1.43.3.
- Permission rules inline their `paramsSchema` at the `createPermissionRule` call site and import Zod via `zod/v3` to match what `@backstage/plugin-permission-node@0.11.0` was compiled against.
- The catalog backend module reads `catalogProcessingExtensionPoint` from the stable export (no `/alpha`) and registers permission rules through `coreServices.permissionsRegistry`.
- React 18 + Node 22 are required at runtime, in line with Backstage v1.50+.
