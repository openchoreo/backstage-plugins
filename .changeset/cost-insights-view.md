---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-portal-app': minor
---

Add a **Cost Insights** sidebar page that visualises the observer's
per-environment FinOps (cost + right-sizing) data. The view is
breadcrumb-scope driven (Namespace → Project → Component) with summary cards
and a Table/Graph toggle at each level.

- **Data layer**: `ObservabilityClient` gains `getCosts` /
  `getCostRecommendations` (resolving the observer URL per
  namespace+environment) plus `CostItem` / `CostRecommendationItem` types.
- **Aggregation**: costs are fetched once per selected environment, plus one
  query over the previous equal-length window for deltas, then aggregated
  client-side — totals, cost-weighted efficiency, `% vs previous window`, and a
  current-month forecast by linear extrapolation. At the component level,
  right-sizing recommendations ("Cost After Optimizing") are attached
- **UI**: breadcrumb scope switcher, environment multi-select, Table/Graph
  toggle, shared Time Range and graph-only granularity filters, summary cards, a
  sortable cost table (catalog-style column sorting, costs shown to 5 decimals
  so sub-cent values are visible), and a recharts stacked-bar graph over time.
  Wired into the portal sidebar and the `/cost-insights` route.
