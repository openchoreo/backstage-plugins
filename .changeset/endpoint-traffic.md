---
'@openchoreo/cell-diagram': minor
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/openchoreo-client-node': minor
---

Manage how an Endpoint's backends get requests: by weight, by condition
(header, cookie or path) or as a mirror. Set up adds and removes backends,
and saving cuts a release with the default split. An environment's
Configure Overrides has a Traffic tab for its own shares, copies and
conditions, which apply there at once without a new release; Clear
Overrides puts it back on the default. The Deploy tab can also open an
environment's K8s artifacts.

The project's Cell Diagram draws each Endpoint on the line its visibility
reaches: from the gateway, or from the caller in the mesh. An Endpoint
with several backends forks at a split point, with each branch labelled
by its share, condition or copy; clicking the split point opens the
Endpoint.
