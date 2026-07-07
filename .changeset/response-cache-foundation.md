---
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-plugin': patch
---

Add a frontend response-caching foundation built on TanStack Query. New
`useOpenChoreoQuery` hook in the React plugin wraps `useQuery` behind a
swappable seam and returns the `{ loading, isRefetching, data, error, refetch }`
shape `ContentLoader` consumes, so cached data paints instantly on remount and a
background refresh no longer blanks the view. As a proof of concept the Deploy
tab's `useEnvironmentData` now fetches through the cache, and the pipeline canvas
shows a subtle "refreshing" overlay on a background refetch instead of clearing.
