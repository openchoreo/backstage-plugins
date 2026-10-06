---
'app': patch
'backend': patch
---

Fix single-object report route authorization in the FinOps and SRE agents to check against the report's own project instead of the caller's, restrict observability-plane ingress to same-namespace traffic, merge partial updates into the existing binding instead of overwriting it in the `update_resource_release_binding` MCP tool, and resolve workload descriptor file paths strictly within the descriptor's own directory.
