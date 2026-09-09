---
'@openchoreo/backstage-portal-app': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
---

Make `@openchoreo/backstage-portal-app` publishable. The portal shell no
longer depends on the private Portal Assistant plugin: the assistant
integration contract (`portalAssistantIntegrationApiRef` /
`usePortalAssistant`, re-exported by the shell) now lives in
`@openchoreo/backstage-plugin-react`, and the stock portal app injects the
assistant through it via `createPortalApp({ features })`, mirroring how the
backend adds the assistant outside `portalBackendFeatures`. Without a
registered integration every slot renders nothing.

This also restores the two assistant surfaces dropped by the NFS entity-page
migration: the component Overview and Build tabs mount the
`BuildFailureNotifier` slot again, and the deploy panel's investigate action
falls back to the integration's `renderInvestigateAction` when no prop is
passed.
