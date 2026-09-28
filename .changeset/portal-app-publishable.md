---
'@openchoreo/backstage-portal-app': minor
---

Make `@openchoreo/backstage-portal-app` publishable. The portal shell no
longer depends on the private Portal Assistant plugin: it consumes the
assistant integration contract from `@openchoreo/backstage-plugin-react`
(`portalAssistantIntegrationApiRef` / `usePortalAssistant`, re-exported by the
shell), and the stock portal app injects the assistant — drawer, agent
client, failed-build and investigate slots, and the runtime-logs investigate
action — through `createPortalApp({ features })`, mirroring how the backend
adds the assistant outside `portalBackendFeatures`. Without a registered
integration every slot renders nothing.
