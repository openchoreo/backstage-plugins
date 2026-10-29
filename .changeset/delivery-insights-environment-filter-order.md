---
'@openchoreo/backstage-plugin-openchoreo-observability': patch
---

Move the environment filter on Delivery Insights from the end of the filter bar
to between namespace and project. Environment selects which data is shown, so it
belongs with the scope controls rather than after time range and granularity,
which only change how that data is drawn.

The scope controls are now composed by the page: `ScopeFilterProvider` holds the
selection and the cascading option lists, and `NamespaceFilter`, `ProjectFilter`
and `ComponentFilter` are placed individually, so a page can order them and put
its own filters among them. Replaces the single `ScopeFilters` component.
