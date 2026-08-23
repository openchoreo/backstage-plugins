---
'@openchoreo/backstage-plugin-catalog-backend-module': patch
---

Fix three `fetchAllPages` call sites in the scheduled entity provider that
ignored the pagination cursor (workflowplanes, observabilityplanes and
deploymentpipelines). Each closure now forwards the cursor and requests
`limit: 100`, so namespaces with more than one page of these resources are
fully ingested instead of silently stopping after the first page.
