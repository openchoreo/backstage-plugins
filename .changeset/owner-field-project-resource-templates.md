---
'@openchoreo/backstage-plugin-catalog-backend-module': patch
'@openchoreo/backstage-plugin-scaffolder-backend-module': patch
---

Add an optional Owner dropdown (groups) to the generated Project and Resource creation templates, mirroring the Component templates. When a group is selected it is persisted on the created Project/Resource CR as the `backstage.io/owner` annotation and applied to the immediate catalog entity's `spec.owner`, so the entity is linked to its owning group. The field is optional — when empty, the default owner is used.
