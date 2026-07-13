import { QueryClient } from '@tanstack/react-query';

/**
 * The single OpenChoreo-wide TanStack Query client. Its defaults are the
 * portal's caching policy — individual hooks (via `useOpenChoreoQuery`) only
 * override `staleTime`/`refetchInterval` where a data class needs it.
 *
 * This lives in `openchoreo-react` (not the host app) so the OpenChoreo NFS
 * features can mount their own `QueryClientProvider` around this exact
 * singleton — see {@link OpenChoreoQueryProvider}. That makes response caching
 * self-contained: an external Backstage host installs the plugins and gets
 * caching with no provider wiring, and the OpenChoreo tabs can never hit the
 * "No QueryClient set" crash from a missing provider.
 *
 * Rationale for the defaults:
 * - `staleTime: 30s` — within this window a revisited tab paints from cache
 *   with no refetch; after it, cached data still paints instantly and a silent
 *   background revalidation runs. Status-y hooks pass a shorter value.
 * - `gcTime: 5m` — how long an unused cache entry survives after its last
 *   observer unmounts, so navigating away and back still hits warm cache.
 * - `refetchOnWindowFocus: false` — this is an internal platform tool; data
 *   isn't second-to-second critical and focus-refetch is surprising here.
 * - `retry: 1` — one retry smooths a transient blip without hammering a slow
 *   BFF or masking a real error for long.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
