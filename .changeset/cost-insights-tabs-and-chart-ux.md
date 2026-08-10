---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-portal-app': minor
---

Reorganise the Cost Insights view into tabs and improve the graph/tooltip UX.

- **Tabs**: the Cost Insights page now hosts two tabs — **Insights** (the
  existing table/graph views) and **Cost Analysis** (the FinOps report list,
  moved here from the project catalog entity page). The Cost Analysis tab
  reuses the existing `CostAnalysisPage` via a synthesised entity context and
  only enables its reports once a project scope is selected. The route is now
  `/cost-insights/*`, and the Incidents "View Cost Analysis" deep link points
  to the new location. The Cost Analysis tab was removed from the catalog
  system page (both the legacy `EntityPage` and the new-frontend-system
  `alpha` registration).
- **Consistent header**: extracted the catalog entity header's gradient bar
  into a reusable `GradientPageHeader` (exported from
  `@openchoreo/backstage-plugin-react`), and used it for the Cost Insights
  header so its purple bar, title sizing and tab seam match the catalog.
  `CompactEntityHeader` now consumes the same shell. Breadcrumb level labels
  are pluralised (`namespaces` / `projects` / `components`) to match the
  catalog.
- **Overview summary card**: the catalog Overview tab now shows a Cost
  Insights summary card at both the project and component levels,
  displaying the last-24-hour total cost (reusing the Total Cost card and,
  for a component, summed across its environments) with a "Go to Cost
  Insights" button that deep-links into the full view.
- **Chart tooltips**: the stacked bar chart and the line chart tooltips now
  show the **Total** of the visible series and **highlight the row** for the
  segment/line under the pointer.
- **Forecast clarity**: the "Forecast this month" summary card and the spend
  forecast chart gained an info tooltip explaining that the forecast projects
  the selected time window's rate across the month, so it can change with the
  chosen range and the amount of data available.
