---
'@openchoreo/backstage-plugin-openchoreo-observability': minor
'@openchoreo/backstage-plugin-openchoreo-observability-backend': minor
'@openchoreo/backstage-plugin-common': minor
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-design-system': minor
'@openchoreo/openchoreo-client-node': minor
'@openchoreo/backstage-portal-app': minor
---

Add an **Audit Logs** sidebar page that reads the observer's audit trail — who
changed what, where, and whether it was allowed.

A top-level page rather than an entity tab: the trail spans every namespace and
the observer evaluates `auditlogs:view` at cluster scope, so the tenancy filters
in a query narrow the result set without widening what the caller may read.

- **Data layer**: `ObservabilityClient` gains `queryAuditLogs` and
  `queryAuditLogFilterValues`, typed against the observer's `AuditLogs`
  operations. Record fields keep their snake_case spelling and the query's own
  controls stay camelCase, so a response can be compared against an exported
  SIEM line key for key. The observer's distinguishable failures become typed
  errors — `501` (the adapter does not serve the trail) and `403` — because each
  asks the UI for a different answer and a flattened error string cannot carry
  them.
- **Paging**: the API has no continuation token, so a page is continued by
  closing the window up to the last record read — `endTime` down when
  descending, `startTime` up when ascending. The window is half-open, so
  descending never repeats a record but cannot reach records sharing the
  boundary's exact `event_time` beyond one page's `limit`; ascending reaches all
  of them and repeats the boundary record, which the hook de-duplicates by
  `event_id`. A tie group wider than a page cannot move the boundary, so paging
  stops there rather than re-requesting the same window.
- **Observer resolution**: the trail has no environment to resolve through, so
  `ObservabilityUrlResolver` gains `resolveForPlatform`, which reads the audit
  observer the API advertises at `/api/v1alpha1/metadata`, exposed as
  `GET /resolve-platform-urls`. An installation that reports audit logs disabled
  gets an empty state rather than a query error.
- **Permission**: `openchoreo.auditlogs.view` → `auditlogs:view`, a cluster-scoped
  (non-resource) permission, with a `useAuditLogsPermission` hook.
- **UI**: a query bar whose vocabulary is the filter set the API actually accepts
  — values are picked from the observer's own aggregation, one filter per request
  and only while a picker is open; outcome tiles counted on a faceted basis so
  selecting Denied does not zero the others; an opt-in stacked timeline; and a
  virtualized record table with a detail drawer whose values drill back into the
  query. Filters live in the URL, so a finding is a link.
- **Shared components**: `TokenFilterBar` is added to
  `@openchoreo/backstage-plugin-react` — a view supplies its own vocabulary and
  a value provider, so nothing audit-specific reaches the shared package.
  `MultiSelectFilter` gains an optional `disabled` on an option, for a value a
  view cannot function without: it is shown checked, cannot be toggled, and
  survives Clear. Two changes to `TimeRangeFilter` affect every consumer
  (Runtime Logs, Platform Logs, Metrics, Traces): its dropdown panel is now at
  least as wide as the field it drops from, rather than narrower and offset,
  and its read-only trigger no longer lets a drag select part of the value.
- **Performance**: rows are windowed (`@tanstack/react-virtual`) and memoized,
  the chart and drawer are `React.lazy`, the timeline aggregation is requested
  once per query rather than per page and not at all while the chart is
  collapsed, and Live polls only the newest page instead of every loaded one.
