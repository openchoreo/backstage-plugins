---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-common': minor
---

Deploy and promote a component's Endpoints with the component.

When a component, or one of its release lines, is deployed, promoted,
redeployed, undeployed or removed from an environment, the Endpoints that line
owns follow it in the same step. Project-owned Endpoints, and those of other
lines, are left alone.

- **Deploy:** each Endpoint is bound to its latest release in the
  environment. Endpoints with `autoDeploy` are left to the controller, which
  already keeps them on their latest release there.
- **Promote:** each Endpoint gets the release its binding pins in the source
  environment, so the same Endpoint version moves with the component, or its
  latest release when it isn't bound there. Every Endpoint is bound, whatever
  its `autoDeploy`.
- **Redeploy:** each Endpoint is bound to its latest release again.
- **Undeploy and remove:** the Endpoints' bindings in that environment are
  deleted, so their routes don't point at a workload that's gone.

An existing binding keeps its environment overrides; only its release
changes. An Endpoint created just before a deploy gets a few seconds to have
its first release cut. An Endpoint that can't follow never undoes the
component's change: the result names it and why, and repeating the action
retries it.

The backend's `PUT /update-release-binding` takes an optional
`sourceEnvironment` (a promotion) and adds an `endpoints` result to its
response. `PATCH /update-binding` and `DELETE /delete-release-binding` now
respond with `{ environments, endpoints }`. The rules are
`planEndpointFollow` in `@openchoreo/backstage-plugin-common`.
