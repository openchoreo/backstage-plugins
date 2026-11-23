---
'@openchoreo/backstage-design-system': patch
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-auth-backend-module-openchoreo-auth': patch
'@openchoreo/backstage-plugin-backend': patch
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
'@openchoreo/backstage-portal-backend': patch
'@openchoreo/cell-diagram': patch
'@openchoreo/openapi-client-generator-node': patch
'@openchoreo/openchoreo-auth': patch
'@openchoreo/openchoreo-client-node': patch
---

Security update: move to Backstage 1.56.6, the last release that runs on
Node 22. This removes `vm2` (pulled in by `@backstage/config-loader` 1.10) and
picks up the Backstage scaffolder, TechDocs, OIDC, catalog, proxy and
`backend-defaults` security fixes. Hosts that install these packages into their
own Backstage app should upgrade it to 1.56.6 as well
(`versions:bump --release 1.56.6`): the frontend plugins now depend on
`@backstage/frontend-plugin-api` 0.18, which a 1.51 app cannot share.

`openChoreoEntityPageOverride` now hides the plugin page header on the entity
page. Backstage's own entity page did this until 1.53; without it a "Catalog"
header appears above the OpenChoreo entity header.
