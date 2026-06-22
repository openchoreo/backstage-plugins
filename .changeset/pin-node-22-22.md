---
'backend': patch
---

Pin the backend Docker image to Node 22.22 to avoid a node-fetch
premature-close regression introduced by the Node 22.23 / 24.17
CVE-2026-48931 keep-alive fix. The internal call from the catalog to the
permission backend (node-fetch@2 → /api/permission/authorize) fails with
ERR_STREAM_PREMATURE_CLOSE on Node 22.23+, surfacing as a 500 on catalog
entities/by-refs ("Failed to load platform details") whenever authz is
enabled. Revert the pin once a Node 22.x release containing
nodejs/node#64004 ships.
