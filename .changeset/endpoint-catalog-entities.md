---
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/openchoreo-client-node': minor
'@openchoreo/backstage-portal-app': minor
---

Ingest OpenChoreo Endpoints into the catalog. Endpoints, EndpointTypes and
ClusterEndpointTypes become catalog entities, kept current by the periodic sync
and by `endpoint`, `endpointtype` and `clusterendpointtype` events.

An Endpoint entity belongs to its project, is an instance of its
(Cluster)EndpointType, and has a `routesTo` relation to each Component it sends
traffic to (`routedBy` on the Component). When the Endpoint declares a schema,
an API entity named `endpoint-<endpoint name>` carries it, and the Endpoint
`providesApi` that entity. Endpoints without a schema get no API entity, and the
API entities already created for workload endpoints are unchanged.

Catalog visibility follows the OpenChoreo `endpoint:view`, `endpointtype:view`
and `clusterendpointtype:view` actions. Endpoints are scoped at project level,
like Resources. The catalog lists the new kinds with their own names and icons.

The OpenChoreo API client is regenerated against an API spec that includes the
Endpoint family.
