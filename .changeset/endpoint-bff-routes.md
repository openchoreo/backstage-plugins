---
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-common': minor
---

Add backend routes and client methods for working with Endpoints:

- `endpoint-environment-info` lists every environment in the project's
  deployment pipeline with the release pinned there, its status, and how each
  backend resolved, including why one did not.
- `update-endpoint-release-binding` deploys, promotes or saves per-environment
  overrides, and `delete-endpoint-release-binding` undeploys. Both find the
  binding for an environment by its owner and environment, so bindings created
  outside the portal are handled too. Saving overrides keeps the release
  pinned there. A new binding needs a release and is named
  `<endpoint>-<environment>`.
- `endpoint-release` reads a release snapshot, and `endpoint-release-schema`
  reads the environmentConfigs schema frozen on it.

The definition editor now supports Endpoints, EndpointTypes and
ClusterEndpointTypes.
