---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-openchoreo-observability-backend': minor
'@openchoreo/openchoreo-client-node': minor
'@openchoreo/backstage-portal-app': minor
---

Add a **Delivery Insights** sidebar page showing the four DORA metrics, scoped
by breadcrumb (Namespace → Project → Component). It sits alongside Cost
Insights in the sidebar rather than on entity pages, since the audience is
delivery leadership looking across an organisation rather than a developer
working on one component.

- **Metrics**: Deployment Frequency, Lead Time for Changes, Change Failure Rate
  and MTTR as KPI tiles with DORA classification, delta vs the previous equal
  window, and sparklines; a trend chart per metric at daily/weekly/monthly
  granularity (lead time shows p50/p75/p95).
- **Drill-down**: a one-level-down breakdown table (namespace → projects,
  project → components, component → environments) sorted by deployment
  frequency, where each row carries its own metrics and an overall DORA rating
  (the scope's weakest tier). Project/component rows narrow the page scope;
  environment rows apply the environment filter.
- **Per-environment cards** for the current scope, plus an environment filter
  and a "how these metrics are calculated" footnote.
- **Bookmarkable views**: scope, range, granularity and environment all live in
  the URL, so a particular view can be shared or saved.
- **Data layer**: `ObservabilityClient` gains `getDoraMetrics` /
  `getDoraDeployments` against the observer's
  `POST /api/v1alpha1/insights/dora/query` and
  `.../insights/dora/deployments/query`, called directly like the other
  observability APIs.
- **URL resolution** gains namespace-level support: `/resolve-urls` now works
  without an `environmentName` by resolving through the namespace's
  environments (new `resolveForNamespace` in the client-node observability URL
  resolver), which is what the org-wide scope needs.
- The namespace/project/component breadcrumb is now a shared `ScopeBreadcrumb`
  component used by both Delivery Insights and Cost Insights.
