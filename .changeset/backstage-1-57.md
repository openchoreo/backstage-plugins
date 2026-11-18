---
'@openchoreo/backstage-design-system': minor
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/backstage-plugin-catalog-backend-module-openchoreo-users': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-openchoreo-ci': minor
'@openchoreo/backstage-plugin-openchoreo-ci-backend': minor
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-openchoreo-observability-backend': minor
'@openchoreo/backstage-plugin-openchoreo-workflows': minor
'@openchoreo/backstage-plugin-openchoreo-workflows-backend': minor
'@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy': minor
'@openchoreo/backstage-plugin-platform-engineer-core': minor
'@openchoreo/backstage-plugin-platform-engineer-core-backend': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-scaffolder-backend-module': minor
'@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks': minor
'@openchoreo/backstage-plugin-tech-insights-backend-module-github': minor
'@openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo': minor
'@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common': minor
'@openchoreo/backstage-plugin-tech-insights-scorecards': minor
'@openchoreo/backstage-plugin-thunder-idp-client-node': minor
'@openchoreo/backstage-portal-app': minor
'@openchoreo/backstage-portal-backend': minor
'@openchoreo/cell-diagram': minor
'@openchoreo/create-portal': minor
'@openchoreo/openapi-client-generator-node': minor
'@openchoreo/openchoreo-auth': minor
'@openchoreo/openchoreo-client-node': minor
---

Move to Backstage 1.57.0. Hosts that install these packages into their own
Backstage app must upgrade it to 1.57 (`versions:bump --release 1.57.0`), with
Node 24.15+ or 26.13+, TypeScript 5.9 and React 18: the plugins now depend on
`@backstage/frontend-plugin-api` 1.x and `@backstage/plugin-catalog-react` 4.x,
which a 1.51 app cannot share. Hosts that cannot upgrade yet should stay on
1.3.x. The legacy frontend exports are unchanged.

`openChoreoEntityPageOverride` now hides the plugin page header on the
entity page. Backstage's own entity page did this until 1.57; without it a
"Catalog" header appears above the OpenChoreo entity header.
