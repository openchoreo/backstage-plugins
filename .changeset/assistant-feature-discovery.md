---
'@openchoreo/backstage-portal-app': patch
---

The portal shell no longer wires the private Portal Assistant. Its drawer, Perch API factory, integration slots and log-row action now ship from the assistant plugin's own `/alpha` default export, which the app installs via `app.packages` feature discovery — so the shell carries no dependency on the private plugin.
