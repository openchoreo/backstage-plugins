---
'@openchoreo/backstage-plugin-react': patch
'@openchoreo/backstage-plugin': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'@openchoreo/backstage-plugin-openchoreo-ci': patch
'@openchoreo/backstage-plugin-openchoreo-workflows': patch
'@openchoreo/backstage-plugin-platform-engineer-core': patch
---

Self-contain the response cache for NFS-mounted OpenChoreo surfaces. Each
OpenChoreo plugin now wraps its own extensions in a TanStack Query
`QueryClientProvider` via `PluginWrapperBlueprint`, around a shared `queryClient`
singleton exported from `@openchoreo/backstage-plugin-react`. A host that mounts
the plugins' `/alpha` features (auto-mounted entity tabs/cards and the standalone
plugin pages) gets response caching with no provider wiring — previously those
surfaces would crash with "No QueryClient set" when a cached tab rendered.

Scope: this covers surfaces rendered through a plugin's own extension boundary
(NFS auto-mounted tabs/cards and standalone plugin pages). A host that instead
composes OpenChoreo tab components itself via legacy `EntityLayout.Route` JSX
renders them outside the plugin wrapper, so that host still mounts its own
provider — `OpenChoreoQueryProvider` (also exported here) bundles the
`QueryClientProvider` and the user-scoping context for that case.

Cross-user isolation is structural: every cache key is namespaced by the
signed-in user's entityRef inside the cache seam (`useOpenChoreoQuery`,
`useOpenChoreoInfiniteQuery`, `useOpenChoreoMutation`, `useOpenChoreoCache`), so
a different user occupies a disjoint key space and can never read the previous
user's permission-scoped responses from the cache — no cache-clearing needed.
Multiple OpenChoreo plugins share the same `queryClient`, so there is one cache.
