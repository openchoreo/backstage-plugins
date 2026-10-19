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
  outside the portal are handled too. A new binding is named
  `<endpoint>-<environment>`.
- `endpoint-release-bindings`, `endpoint-release` and `endpoint-release-schema`
  read bindings and the release snapshots, and `endpoint-type-schema` and
  `cluster-endpoint-type-schema` read type parameter schemas.

The definition editor now supports Endpoints, EndpointTypes and
ClusterEndpointTypes.
