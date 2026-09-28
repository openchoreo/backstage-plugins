---
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Project the `backstage.io/owner` CR annotation onto `spec.owner` and emit the `ownedBy`/`ownerOf` relations for all managed entity kinds, so the About card shows the owner for platform/cluster-scoped kinds (ClusterDataplane, Dataplane, Environment, the *Plane / *Type / Workflow kinds, etc.) — not just Components and Projects. The owner resolution now runs in the shared `applyMetadataLabels` finalizer (covering every `translate*`), and a new `OwnerRelationProcessor` emits the ownership relations for the custom kinds that Backstage's built-in owner processing ignores. Owner is set only when the annotation is present; without it, entities keep the existing "No Owner" behaviour.
