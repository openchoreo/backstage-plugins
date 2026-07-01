---
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/openchoreo-client-node': minor
---

support opting a (Cluster)ComponentType or (Cluster)ResourceType out of auto-generated scaffolder Template (create card) emission via the `openchoreo.dev/skip-template-generation: "true"` annotation. Both the periodic full sync and the event-driven delta path honor it; the delta path actively removes a previously emitted Template when the annotation is added to a live resource. Useful when a type is served by a hand-authored template or is not meant to be user-creatable from the portal.
