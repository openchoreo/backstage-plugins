---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-common': minor
---

Deploy and promote a component's Endpoints with the component.

When a component, or one of its release lines, is deployed to, promoted to
or removed from an environment, the Endpoints that line owns follow it in the
same step. Project-owned Endpoints, and those of other lines, are left alone.

- **Deploy:** each Endpoint is bound to its latest release in the
  environment. Endpoints with `autoDeploy` are left to the controller, which
  already keeps them on their latest release there.
- **Promote:** each Endpoint gets the release its binding pins in the source
  environment, so the same Endpoint version moves with the component. Every
  Endpoint is bound, whatever its `autoDeploy`. If any of them isn't deployed
  in the source environment, the promotion is rejected (409) before anything
  changes, with a message naming them.
- **Suspend, undeploy and redeploy:** only the component's binding changes.
  The Endpoints' bindings stay, with their release and environment settings;
  an Endpoint is managed from its own Deploy tab.
- **Remove:** once the component's deployment is found, the Endpoints'
  bindings in that environment are deleted, then the component's, so their
  routes don't point at a workload that's gone.

An existing binding keeps its environment overrides; only its release
changes. An Endpoint created just before a deploy gets a few seconds to have
its first release cut. An Endpoint that can't follow never undoes the
component's change: the result names it and why, and points at the
Endpoint's Deploy tab to put it right.

The backend's `PUT /update-release-binding` takes an optional
`sourceEnvironment` (a promotion) and adds an `endpoints` result to its
response. `DELETE /delete-release-binding` now responds with
`{ environments, endpoints }`. The rules are
`planEndpointFollow` in `@openchoreo/backstage-plugin-common`.
