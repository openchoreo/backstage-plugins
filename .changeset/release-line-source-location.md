---
'@openchoreo/backstage-plugin-catalog-backend-module': minor
'@openchoreo/backstage-plugin-backend': patch
---

ReleaseLine entities carry `backstage.io/source-location` and `openchoreo.io/branch`, as components do. Both come from the component's workflow parameters with the line's override merged over them, so a line that overrides only its branch keeps the component's repository and app path. A line of a component built from an image gets neither. A line created or edited in the portal has them as soon as it reaches the catalog.
