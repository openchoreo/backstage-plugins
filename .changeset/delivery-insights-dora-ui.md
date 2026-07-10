---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-openchoreo-observability-backend': minor
'@openchoreo/openchoreo-client-node': minor
---

Add the Delivery Insights (DORA metrics) UI: an Insights tab on the namespace
(domain), project (system), and component entity pages with two inner tabs —
Delivery Insights and Cost Insights. Delivery Insights shows the four DORA
metrics (Deployment Frequency, Lead Time for Changes, Change Failure Rate,
MTTR) as KPI tiles with DORA classification, delta vs the previous window, and
sparklines; trend charts per granularity (daily/weekly/monthly); a
one-level-down breakdown table (projects → components → environments) with
row drill-down; per-environment metric cards; and an environment filter. The
Cost Insights tab embeds the existing FinOps cost analysis at project level.
Data comes from the observer's new `POST /api/v1alpha1/insights/dora/query`
endpoint, called directly like the other observability APIs. URL resolution
gains namespace-level support: `/resolve-urls` now works without an
`environmentName` by resolving through the namespace's environments (new
`resolveForNamespace` in the client-node observability URL resolver).
