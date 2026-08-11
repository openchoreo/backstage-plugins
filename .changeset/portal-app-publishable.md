---
'@openchoreo/backstage-portal-app': minor
'@openchoreo/backstage-plugin': patch
---

Make `@openchoreo/backstage-portal-app` publishable. The portal shell no
longer depends on the private Portal Assistant plugin: the shell now exposes
optional integration slots (`portalAssistantIntegrationApiRef` /
`usePortalAssistant`) and the stock portal app injects the assistant through
them via `createPortalApp({ features })`, mirroring how the backend adds the
assistant outside `portalBackendFeatures`. Without a registered integration
every slot renders nothing.
