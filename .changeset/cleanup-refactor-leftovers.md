---
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-common': patch
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
'@openchoreo/backstage-plugin-backend': patch
'@openchoreo/backstage-plugin-openchoreo-ci-backend': patch
'@openchoreo/backstage-plugin-platform-engineer-core': patch
'@openchoreo/backstage-design-system': patch
---

chore: remove dead code left over from the OpenAPI-client and New Frontend
System migrations — commented-out blocks, orphaned files/components, and unused
deprecated exports (`LogEntry`/`RuntimeLogsResponse` aliases, `FILTER_PRESETS`,
`useOrgName`, `useRCAReportByAlert`, `UserTypeConfig`), plus consolidation of
duplicated backend response-type wrappers. No behavioural changes.
