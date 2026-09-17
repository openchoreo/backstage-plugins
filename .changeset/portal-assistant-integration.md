---
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin': minor
'@openchoreo/backstage-plugin-openchoreo-ci': minor
'app': minor
---

Restore the Portal Assistant surfaces that were dropped in the New Frontend
System entity-page migration.

Introduce a decoupled assistant-integration contract in
`@openchoreo/backstage-plugin-react` (`portalAssistantIntegrationApiRef`,
`usePortalAssistant`, `BuildFailureNotifierSlot`) so no plugin depends on the
private portal-assistant plugin. The OpenChoreo plugins consume it: the
component Overview layout and the Workflows (Build) page mount
`BuildFailureNotifierSlot`, and the deploy panel (`Environments`) falls back
to the contract's `renderInvestigateAction` slot when mounted propless.

The portal app registers the provider for these slots (the composition root
owns the portal-assistant dependency), wiring the failed-build launcher and
the deploy-panel "Investigate with AI" action back in. With the assistant
feature enabled, the failed-build prompt reappears on the Overview and Build
tabs and the investigate action on a pending/failed deployment. When no
assistant is registered every slot renders nothing.
