---
'@openchoreo/backstage-plugin-catalog-backend-module': patch
'@openchoreo/backstage-plugin-scaffolder-backend-module': patch
---

Add an optional **Owner** field to dynamically generated component templates. The Component Metadata step now lists catalog Groups via an `OwnerPicker`; when a group is selected it is persisted on the created Component CR as the `backstage.io/owner` annotation and applied to the immediately-inserted catalog entity's `spec.owner`. The catalog sync already resolves this annotation onto `spec.owner` (`resolveComponentOwner`), so the component is linked to its owning group in the catalog. The field is optional — when left empty, the default owner is used.
