---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/openchoreo-client-node': minor
---

Manage an Endpoint's backends and see its URLs on its Deploy tab.

The Set up pane on the Deploy tab lists the Endpoint's backends with the share
of traffic each receives, and adds, reweights and removes them:

- any workload endpoint in the project can be added;
- an Endpoint takes 1 to 16 backends, weights are whole numbers from 0 to
  1,000,000, and at least one backend must take traffic;
- adding a backend on another component to a component-owned Endpoint moves
  the Endpoint to its project, and the dialog says so first;
- changes need the `openchoreo.endpoint.update` permission.

Each change cuts a new release, which the pane offers to deploy. The Overview's
Routing card is read-only. The backend adds `POST`, `PATCH` and `DELETE
/endpoint-backends`.

Each environment on the Deploy tab lists the URLs the Endpoint is invoked at
there, per visibility, with the security a caller must present. Its last deploy
time comes from the binding's `lastSpecUpdateTime`, so it moves on every
deploy. Refreshing an entity no longer swaps its page for a spinner, so open
panes stay open.

Endpoint entities carry their owning component in the
`openchoreo.io/endpoint-owner-component` annotation.

The OpenChoreo API client is synced to openchoreo `main`. Workload endpoints
have a `protocol` field, and the deprecated `type` is optional; read them
through the new `endpointProtocol()` helper.
