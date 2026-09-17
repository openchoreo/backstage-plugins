---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
---

Remove the `unauthenticated` outcome from the Audit Logs page: it is no longer offered as
a result filter, and the event drawer no longer shows the token rejection notice. Requests
rejected at authentication are recorded in the access log rather than the audit trail.
