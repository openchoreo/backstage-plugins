---
'@openchoreo/openchoreo-client-node': minor
---

Harden `fetchAllPages` with an optional options bag: `maxPages` caps how
many pages are fetched (throwing instead of silently truncating, and kept
opt-in with no default so existing callers see no new failure modes),
`timeoutMs` gives the whole run a wall-clock budget (chosen as a finite
60s default so unbounded pagination cannot hang a backend, with `0` as
the escape hatch that disables it), and `signal` lets callers abort the
run at entry and between pages. The helper now also detects stuck
cursors (a page returning the same non-empty cursor it was fetched with)
and malformed page responses (a nullish page or a missing `items`
array), throwing descriptive errors that name the page index, cursor,
and collected item count. `PaginatedResponse` and the new
`FetchAllPagesOptions` type are now exported. Behavior is unchanged for
callers that pass only `fetchPage`, apart from the new default timeout
kicking in.
