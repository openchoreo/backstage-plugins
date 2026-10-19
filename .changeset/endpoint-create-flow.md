---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/backstage-plugin-scaffolder-backend-module': minor
'@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy': minor
'@openchoreo/backstage-portal-app': minor
---

Create Endpoints from a project. The project's Create button has a Create
Endpoint option, which opens a new Endpoints view on the create page. That view
lists one generated template per (Cluster)EndpointType, kept in sync with the
types by the catalog.

The wizard asks for:

- the Endpoint's name;
- the scopes it is exposed to;
- its backends: components of the project, each with one of its internal or
  external workload endpoints and a relative weight;
- the type's parameters.

The API schema is pre-filled from the first backend's workload endpoint and can
be edited. The new `openchoreo:endpoint:create` action creates the Endpoint and
adds it, with the API entity for its schema, to the catalog straight away.

Creating Endpoints is gated by the new `openchoreo.endpoint.create` permission.
