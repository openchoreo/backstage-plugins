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
 * - `staleTime: 0` — stale-while-revalidate for OBSERVERS: a hook built on
 *   `useOpenChoreoQuery` paints cached data instantly (from the still-warm
 *   `gcTime` entry) AND always kicks a background revalidation, then RE-RENDERS
 *   when it lands, so data on screen is never left silently stale. Data is fresh
 *   cluster/BFF state, so we prefer an always-up-to-date view over suppressing
 *   refetches within a freshness window. Concurrent callers still dedupe to one
 *   request; an explicit `refetch()`/invalidate is immediate regardless. Pollers
 *   set their own `refetchInterval`.
 *
 *   This is the right policy only where a subscriber exists to receive the
 *   revalidation. {@link CachingCatalogApi} deliberately overrides it with its
 *   own short `staleTime`, because it serves a promise API whose callers can
 *   never be notified after the fact — see the rationale there before copying
 *   this default into another non-React seam.
 * - `gcTime: 5m` — how long an unused cache entry survives after its last
 *   observer unmounts, so navigating away and back still hits warm cache. With
 *   `staleTime: 0` this is what carries the instant-paint on revisit.
 * - `refetchOnWindowFocus: false` — this is an internal platform tool; data
 *   isn't second-to-second critical and focus-refetch is surprising here.
 * - `retry: 1` — one retry smooths a transient blip without hammering a slow
 *   BFF or masking a real error for long.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
