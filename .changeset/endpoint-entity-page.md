---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-permission-backend-module-openchoreo-policy': minor
---

Add an Endpoint entity page. Its Overview shows:

- **Routing:** the (Cluster)EndpointType that renders it, the scopes it is
  exposed to, and each backend component with its share of traffic.
- **Deployments:** the status in each environment, with a link to the Deploy
  tab.
- **API:** a link to the API entity carrying its schema, when it has one.

The Definition tab and the delete action now cover Endpoints, EndpointTypes
and ClusterEndpointTypes, gated by new `openchoreo.endpoint.*`,
`openchoreo.endpointtype.*` and `openchoreo.clusterendpointtype.*` update and
delete permissions. The Developer Resources graph view includes Endpoints and
the components they route to.
