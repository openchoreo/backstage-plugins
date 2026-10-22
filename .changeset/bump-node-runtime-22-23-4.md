---
'backend': patch
---

Bump the backend runtime image to the current `gcr.io/distroless/nodejs22-debian13:nonroot`
digest (Node 22.23.4). The previous image shipped Node 22.23.2, whose bundled root store and
system CA bundle both still trusted emSign ECC Root CA - G3, the eMudhra root removed after
the eMudhra intermediate CA key compromise. The new image drops it from both.
