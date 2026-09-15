---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-design-system': minor
'@openchoreo/backstage-portal-app': minor
---

Improve the Cost Insights view UX.

- **Single page**: removed the Table/Graphs toggle - the graphs and the cost
  table now render on one page (table after the graphs), and the Total Cost /
  Forecast this month / Efficiency tiles were removed.
- **Accumulated cost & forecast chart**: the former "Spend forecast" chart is
  renamed to **"Accumulated cost and forecast"** and reworked. It always covers the
  current calendar month (no longer affected by the time-range filter): it shows
  the actual cost accumulated from the 1st to today, then projects month-end
  spend at the current rate and if the recommendations are applied. The two
  forecast lines are now visually distinct (dashed vs dotted), and the axis ends on
  the month's last day. The time-range selector moved below this chart since it
  only drives the views under it.
- **Cost vs efficiency**: added a "Potential savings" legend heading and removed
  the red low-efficiency shaded region.
- **Refresh**: added a Refresh button to re-fetch cost data without a page
  reload.
- **Scope filters**: the Project and Component filters now show "All" (not
  "None") when nothing is explicitly selected, since an empty selection
  aggregates everything. `MultiSelectFilter` gained an optional `emptyLabel`
  prop for this.
- **Fixes**: the platform-level "not enabled" message now reads "Cost Insights
  have not been enabled" instead of the component-scoped observability message,
  and the numeric cost-table column headers are right-aligned with their values.
- **Sidebar**: moved "Platform" and "Cost Insights" into their own
  divider-bounded section after "API", separating platform concerns from the
  main menu.
