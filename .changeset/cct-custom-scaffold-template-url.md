---
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/backstage-plugin-common': minor
---

Add support for custom component-creation templates. A (Cluster)ComponentType
can now set the `scaffolder.openchoreo.dev/backstage-template-url` annotation to
point at a hand-authored Backstage scaffolder Template. When present, the catalog
sync fetches that Template from the URL (via the configured `integrations`) and
emits it in place of the auto-generated wizard; when absent, behaviour is
unchanged. Applies to both the periodic and event-driven sync paths. If the URL
cannot be read or does not yield a valid `kind: Template`, an error is logged and
no template is emitted for that type.
