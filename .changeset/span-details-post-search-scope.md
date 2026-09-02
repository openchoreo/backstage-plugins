---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Fetch span details via the new `POST /traces/{traceId}/spans/{spanId}` endpoint with `searchScope` in the body, and read span `status` from its `code` field so expanding a trace no longer crashes.
