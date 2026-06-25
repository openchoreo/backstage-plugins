---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-backend': patch
---

Limit how long a wirelogs stream can run. Wirelogs (Cilium Hubble flows) previously streamed indefinitely — there's no upstream timeout, so a forgotten tab could hold an open SSE connection for hours and degrade the browser.

The backend `/wirelogs/stream` proxy now enforces a hard cap (default 15 minutes, configurable via `openchoreo.observability.wirelogs.streamTimeoutSeconds`): it advertises the cap to the client in a `meta` SSE frame and, on hitting it, sends a `timeout` frame before closing so the UI can label the stop precisely. The wirelogs view layers graduated soft warnings over this — confirmation dialogs at roughly one-third and two-thirds of the cap let the user stop early or knowingly continue, and a toast explains when the server ends the stream (the Start button resumes a fresh session).
