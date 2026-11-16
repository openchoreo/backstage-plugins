---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/backstage-plugin-scaffolder-backend-module': minor
---

Expose a component's endpoints through Endpoints, from its configure page.

Component creation no longer asks for endpoints: the creation form drops its
Endpoints section, the scaffolder creates the workload without endpoints, and
the legacy `port` parameter no longer adds an `http` endpoint. A component's
endpoints are defined on its configure page after creation.

The component's ComponentType decides the form of the configure page's
Endpoints tab. Before upgrading, platform engineers annotate every
(Cluster)ComponentType that predates Endpoints with
`openchoreo.dev/legacy-endpoints: "true"`. Its components get the legacy form:
visibility stays on the workload (deprecated), served by the type's own
templated routes, and no Endpoints are created. Every other ComponentType gets
the Endpoints form, which exposes each workload endpoint with a visibility
beyond project through an Endpoint, from the EndpointTypes the ComponentType
allows for the endpoint's protocol (`allowedEndpoints`; the protocol's default
is preselected). The Endpoint carries that visibility, which is dropped from
the workload; a protocol no allowed type serves stays project-scoped. When the
annotation is removed, a component whose workload still carries visibility
moves it to Endpoints with its next save, which the save confirmation lists.
There's no switching between forms.

Inside each workload endpoint's row, the page shows the Endpoints the
component owns for it: type, visibility, Ready state and parameters. Each can
be edited or deleted, and changes are staged with the workload and saved after
it. A renamed workload endpoint keeps its Endpoints; one that's removed or
loses its visibility beyond project has its Endpoints deleted on save. The
endpoint editor's Type field is now Protocol.

The component owns the Endpoints created here (`spec.owner.componentName`), so
deleting the component deletes them. A release line's configure page manages
the line's own Endpoints (`spec.owner.releaseLineName`) and offers the main
line's Endpoints as drafts to review and save for the line. When a backend
added elsewhere routes outside the owner, the API widens the owner, and the
Endpoint leaves the configure page.

The backend adds `/component-endpoints` (GET, POST, PUT, DELETE), which only
touches Endpoints the component's line owns and returns the ComponentType's
`allowedEndpoints` and legacy annotation, `/release-line-endpoint-drafts`,
and `/endpoint-type-schema` and `/cluster-endpoint-type-schema` for the
parameters form. Naming and building these Endpoints, and choosing their
EndpointType, live in `@openchoreo/backstage-plugin-common`.

Project contents no longer list Endpoints a component owns. Catalog Endpoint
entities carry an `openchoreo.io/endpoint-scope` label, `component` or
`project`, so views can filter on it.
