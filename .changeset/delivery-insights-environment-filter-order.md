---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Move the environment filter on Delivery Insights from the end of the filter bar
to between namespace and project. Environment selects which data is shown, so it
belongs with the scope controls rather than after time range and granularity,
which only change how that data is drawn. `ScopeFilters` takes a new optional
`afterNamespace` slot to place it.
