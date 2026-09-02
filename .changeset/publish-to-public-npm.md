---
'@openchoreo/backstage-plugin': patch
---

Publish `@openchoreo/*` to the public npm registry instead of GitHub Packages. Installing the plugins no longer requires a GitHub personal access token or any registry configuration. Releases are published from CI via npm trusted publishing (OIDC), so every version from this release onward carries a signed provenance attestation.
