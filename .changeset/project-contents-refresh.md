---
'@openchoreo/backstage-plugin-react': minor
'@openchoreo/backstage-plugin': patch
---

Add a Refresh action to the Project Contents card and back it with the response
cache.

A Refresh icon button next to the "Project Contents" title re-pulls the table
rows (and their per-environment deployment status) together with the count badge
and type-filter options. `useProjectContentsPage` moves off a hand-rolled
`useEffect` fetch onto `useOpenChoreoQuery`, split into two dependent queries
(page rows + visible-row deployment bindings), so it gains `refetch`/
`isRefetching` and smoother paging. The card also reserves a full page's height
so navigating to a shorter last page no longer makes the widget jump.

`useOpenChoreoQuery` gains an optional `keepPreviousData` flag (forwarded as
`placeholderData: keepPreviousData`) so paginated queries can keep the previous
page on screen while the next one loads. It is additive and only applied when
set, so existing callers are unchanged.
