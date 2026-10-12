---
'@openchoreo/backstage-plugin-openchoreo-image-security': minor
'@openchoreo/backstage-plugin-openchoreo-image-security-backend': minor
---

Add a Security tab to OpenChoreo components showing, per environment, the fixable vulnerabilities of the running image, read from the signed cosign vulnerability attestation attached to it (for example by a build step running Trivy). The backend plugin stays disabled unless `openchoreo.imageSecurity` is configured.
