---
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin-backend': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/openchoreo-client-node': minor
---

Notification channels read their secret values from SecretReferences. The create form picks
SMTP credentials and webhook header secrets from the namespace's SecretReferences (those with no
target plane or targeting an observability plane), with a key dropdown, instead of free-text
Kubernetes Secret names. The channel's overview card shows its secret references with their keys,
its Ready status, and a warning when it still copies values from Kubernetes Secrets, which is
deprecated. The Secrets page can create secrets in an `ObservabilityPlane` or
`ClusterObservabilityPlane` secret store, and the client is regenerated for the observability
plane `secretStoreRef`, the new target plane kinds and the channel status conditions.
