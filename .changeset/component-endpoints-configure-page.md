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

The configure page's Endpoints tab has two forms. The Endpoints form, the
default, exposes each workload endpoint with a visibility beyond project
through an Endpoint, from the EndpointTypes the component's ComponentType
allows for the endpoint's protocol (`allowedEndpoints`; the protocol's default
is preselected). The Endpoint carries that visibility, which is dropped from
the workload; a protocol no allowed type serves stays project-scoped. The
legacy form keeps visibility on the workload (deprecated) for the component
type's own routes; the page opens in it only when workload endpoints carry
that visibility and the component has no Endpoints, with a banner asking to
migrate. Switching applies on save, and the save confirmation lists it.

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
touches Endpoints the component's line owns, `/release-line-endpoint-drafts`,
and `/endpoint-type-schema` and `/cluster-endpoint-type-schema` for the
parameters form. Naming and building these Endpoints, and choosing their
EndpointType, live in `@openchoreo/backstage-plugin-common`.

Project contents no longer list Endpoints a component owns. Catalog Endpoint
entities carry an `openchoreo.io/endpoint-scope` label, `component` or
`project`, so views can filter on it.
