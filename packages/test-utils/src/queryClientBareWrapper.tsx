import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * A `wrapper` that mounts children inside a fresh `QueryClientProvider` ONLY —
 * no `TestApiProvider`. Use this for suites that already supply their APIs by
 * mocking `@backstage/core-plugin-api`'s `useApi` directly, where pulling in
 * `TestApiProvider` (and its `@backstage/core-app-api` internals) would clash
 * with that mock. Kept in its own module (importing only react-query, never
 * `@backstage/test-utils`) so consuming it doesn't drag `TestApiProvider` into
 * a suite that has mocked its dependencies away. Also keeps `@tanstack/react-query`
 * behind this package's seam so consuming plugins don't declare it just to wrap
 * a component test.
 */
export function createQueryClientWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
