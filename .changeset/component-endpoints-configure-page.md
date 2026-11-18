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

The component's ComponentType decides what the configure page's Endpoints tab
shows. Before upgrading, platform engineers annotate every
(Cluster)ComponentType that predates Endpoints with
`openchoreo.dev/legacy-endpoints: "true"`.

- An annotated type gets the legacy form: the workload endpoint editor, with
  visibility on the workload (deprecated), served by the type's own templated
  routes. No Endpoints are created.
- A type with `allowedEndpoints` gets the Endpoints form: one card per
  endpoint. **Add Endpoint** first shows a card for each Endpoint type in
  `allowedEndpoints`, with its title, description and protocols from the
  catalog. Picking one opens the endpoint's form under that type's name and
  description, with its name, protocol (limited to those the type serves),
  port, visibility, schema and the type's parameters, in two halves split by
  a line: the endpoint's own fields on the left and the type's parameters on
  the right, which scroll within the left half's height. Project is a visibility like the others: the
  Endpoint carries every visibility chosen, project included, so an endpoint
  with only Project ticked gets an Endpoint with `project` visibility (this
  needs an openchoreo that accepts it). Saving creates the Endpoint and
  drops the visibility from the workload.
  Workload endpoints without an Endpoint stay within the project, and those
  from before Endpoints, which carry visibility beyond project but have no
  Endpoint, get no card and stay on the workload as they are.
- A type with neither shows no form, and saving changes no Endpoints.

In YAML mode the configure page has a tab for the Workload and one for each
of the component's Endpoints, existing or to be created, showing the Endpoint
as saving will leave it. An existing Endpoint's tab edits its
`spec.visibility` and `spec.parameters`; one to be created can also change its
`spec.type` and the workload endpoint its backend routes to. **Add Endpoint**
opens a new Endpoint's YAML: write it, add the workload endpoint it routes to
in the Workload tab, and it joins the page's changes. Saving waits until every
new Endpoint is complete. A tab's ✕ removes the Endpoint and leaves its
workload endpoint within the project.

A card with an Endpoint shows its name, Ready state, type and parameters. It can
be edited or deleted, and changes are staged with the workload and saved after
it. A renamed workload endpoint keeps its Endpoints; one that's removed has
its Endpoints deleted on save. The endpoint editor's Type field is now
Protocol.

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
