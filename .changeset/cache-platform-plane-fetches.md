---
'@openchoreo/backstage-plugin-platform-engineer-core': patch
'@openchoreo/backstage-plugin': patch
---

Route the platform "planes" fetches through the response cache so they paint
instantly on revisit instead of re-fetching from the catalog/BFF every time.

The caching migration had skipped the `platform-engineer-core` plugin, so the
Platform Engineer home/dashboard re-queried every plane list on each visit.
Migrated the three dashboard widgets (`HomePagePlatformDetailsCard`,
`InfrastructureWidget`, `AgentHealthWidget`) and the two observability-plane
"linked planes" cards in the openchoreo plugin to `useOpenChoreoQuery` with
domain-prefixed keys.
