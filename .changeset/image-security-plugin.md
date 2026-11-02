---
'@openchoreo/backstage-plugin-openchoreo-image-security': minor
'@openchoreo/backstage-plugin-openchoreo-image-security-backend': minor
---

Add a Security tab to OpenChoreo components showing, per environment, the fixable vulnerabilities of the running image, read from the signed cosign vulnerability attestation attached to it (for example by a build step running Trivy). Both halves are opt-in: the backend plugin stays disabled unless `openchoreo.imageSecurity` is configured, and the Security tab is disabled until `entity-content:openchoreo-image-security/security` is enabled under `app.extensions`.
