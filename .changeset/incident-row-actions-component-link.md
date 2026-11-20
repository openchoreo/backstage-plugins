---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Show Acknowledge and Resolve in the Actions column of the project incidents
table for every incident, not only in the expanded details. Without AI RCA
enabled the column was empty, so acknowledging an incident meant expanding its
row first.

Link the component name on each incident, in the row and in the expanded
details. An incident raised by a release line links to that line's page, since
the incident belongs to the line; a main-line incident links to the
component's catalog page.
