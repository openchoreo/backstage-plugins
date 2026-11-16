---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/openchoreo-client-node': minor
---

Route an Endpoint's traffic to a component's release lines, for a canary.

The Add backend dialog on an Endpoint's Set up pane offers the workload
endpoints of each component's release lines next to its main line's, labelled
`component @ line / endpoint`. A backend on a release line is named
`<component>-<line>-<endpoint>`, and `POST /endpoint-backends` takes an
optional `releaseLine`. The backend lists on the Set up pane and the Overview
show each backend's line.

When a release line owns an Endpoint, the dialog warns that a backend on
another line moves the Endpoint to its component, and one on another component
moves it to the project.

Endpoint entities keep each backend's `releaseLine`, and carry the owning line
in the `openchoreo.io/endpoint-owner-release-line` annotation.

The OpenChoreo API client is synced to openchoreo `main`, which adds
`backendRefs[].component.releaseLine` and `spec.owner.releaseLineName` to
Endpoints.
