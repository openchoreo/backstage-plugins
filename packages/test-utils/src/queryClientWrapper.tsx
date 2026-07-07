import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TestApiProvider } from '@backstage/test-utils';

/** A single `[ApiRef, mockImpl]` pair, matching `TestApiProvider`'s `apis` prop. */
type ApiPair = [unknown, unknown];

/**
 * A `QueryClient` tuned for tests: no retries (a rejected fetcher surfaces its
 * error immediately instead of after retry backoff) and `gcTime: 0` so nothing
 * leaks between test cases. Create a fresh one per test to avoid cross-test
 * cache bleed.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

/**
 * Builds a `wrapper` for `renderHook`/`render` that mounts children inside a
 * fresh `QueryClientProvider` **around** the usual `TestApiProvider` — the two
 * layers any hook built on `useOpenChoreoQuery` needs. Drops into the repo's
 * existing test idiom:
 *
 * @example
 * ```tsx
 * const { result } = renderHook(() => useEnvironmentData(entity), {
 *   wrapper: createQueryWrapper([[openChoreoClientApiRef, mockClient]]),
 * });
 * ```
 *
 * @param apis - `[ApiRef, mock]` pairs, exactly as passed to `TestApiProvider`.
 */
export function createQueryWrapper(apis: ApiPair[] = []) {
  const queryClient = createTestQueryClient();
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TestApiProvider apis={apis as any}>{children}</TestApiProvider>
    </QueryClientProvider>
  );
}
