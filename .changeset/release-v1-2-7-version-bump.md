---
'app': patch
'backend': patch
'@openchoreo/backstage-plugin': patch
---

Fix single-object report route authorization in the FinOps and SRE agents to check against the report's own project instead of the caller's, and restrict observability-plane ingress to same-namespace traffic.
