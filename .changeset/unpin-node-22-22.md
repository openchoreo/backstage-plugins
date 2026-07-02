---
'backend': patch
---

Float the backend Docker image base back to `node:22` (>= 22.23.1) now that
Node 22.23.1 has shipped nodejs/node#64004, which reverts the keep-alive
socket-reuse regression that the 22.23.0 CVE-2026-48931 fix introduced. The
temporary `node:22.22` pin is no longer needed: the node-fetch@2
premature-close failure on internal service-to-service calls (catalog ->
permission) no longer reproduces on 22.23.1+.
