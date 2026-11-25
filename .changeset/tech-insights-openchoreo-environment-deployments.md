---
'@openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo': minor
---

The deployment retriever reports `openchoreoEnvironmentDeployments`, a list with one entry per
environment a component's main line or a release line is bound to. Each entry says whether the
environment is production, whether the binding is synced, ready and on the latest release, and the
image registry, image pinning, plain secret-like env values and external Endpoints of the release
deployed there. Checks select entries by path, e.g.
`$[?(@.isProduction)].isReady` with `everyFact:equal`. The image and env values now come from each
binding's ComponentRelease, and external endpoints from Endpoint resources, which need
`endpoint:view` and `endpointreleasebinding:view` on the project.

The image and env fields, and the starter checks on plain-text secrets and pinned images that use
them, need the portal's service client to hold `componentrelease:view`. The OpenChoreo control
plane chart grants it to `backstage-catalog-reader` from the release that includes
openchoreo/openchoreo#5594. Portals using another service client must grant it themselves, or
those fields are left out and the two starter checks fail.

`openchoreoDeployedEnvironments`, `openchoreoDeployedToProduction`,
`openchoreoReadyInAllEnvironments`, `openchoreoRunsLatestRelease`,
`openchoreoPlainTextSecretEnvCount`, `openchoreoImagePinned`, `openchoreoImageRegistry` and
`openchoreoExternalEndpointCount` are removed. Checks that use them need to move to the list.
