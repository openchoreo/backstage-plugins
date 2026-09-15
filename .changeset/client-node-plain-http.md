---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/openchoreo-client-node': patch
---

Allow the API client to send a token over plain HTTP. Backstage reaches the
OpenChoreo API over the in-cluster service URL, which is not TLS-terminated.

A quick fix whose `target_kind` this portal version cannot route is now shown
as unsupported instead of failing the Quick Fixes tab.
