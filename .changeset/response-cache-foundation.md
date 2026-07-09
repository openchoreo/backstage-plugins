---
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
---

Introduce a frontend response cache (TanStack Query) behind a swappable seam and
migrate the portal's data-fetching hooks onto it, so cached data paints
instantly on remount and a background refresh no longer blanks the view.

New hooks in `@openchoreo/backstage-plugin-react`, all wrapping TanStack Query so
plugins never import it directly:

- `useOpenChoreoQuery` — cached reads, returning the
  `{ data, loading, isRefetching, error, refetch }` shape the loaders consume.
- `useOpenChoreoMutation` — writes that re-throw on error and invalidate cached
  queries on success (replacing the hand-rolled "call verb then refetch").
- `useOpenChoreoInfiniteQuery` — cursor-paginated "load more + live poll" lists
  (runtime logs/events).
- `useOpenChoreoCache` — imperative cache access for optimistic writes and the
  lazy, dynamically-keyed hooks.

Migrated across the openchoreo, observability, CI and workflows plugins: simple
and parameterized reads, read+mutation hooks, `setInterval` pollers (now
`refetchInterval` with terminal stop conditions), lazy/conditional and
keyed-Map hooks, the log/event pagination trio, and the `react-use` `useAsync`
sites. `useAsyncOperation` is deprecated in favour of `useOpenChoreoMutation`.
The provider is mounted in the app root and the cache is cleared on sign-out.

The seam only forwards `staleTime`/`refetchInterval`/`enabled` when a caller
actually sets them — passing an explicit `undefined` overrides the QueryClient
default instead of inheriting it, which resolved `staleTime` to 0 and refetched
on every remount, silently defeating the shared 30s cache.

The cell-diagram and wirelogs environment hooks no longer fold `isRefetching`
into `loading`; a background refresh kept re-showing their full skeleton (the
"blank on refresh" the cache was meant to remove). They now report `loading`
for the first load only and expose `isRefetching` separately.
