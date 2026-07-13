import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { queryClient } from './queryClient';

/**
 * The signed-in user's entityRef, used to namespace every cache key so one
 * user can never read another user's permission-scoped responses (see
 * {@link useUserScopedKey}). `undefined` until the identity resolves; the
 * sentinel below is used for keys built in that window.
 */
const UserScopeContext = createContext<string | undefined>(undefined);

/**
 * Key prefix used before the identity has resolved. Distinct from any real
 * entityRef, so a query started pre-resolution keys under its own scope and
 * simply re-keys (one refetch) once the real user is known — it never lands in
 * a different user's scope.
 */
const PENDING_USER = '@openchoreo/pending-user';

/**
 * Returns a function that namespaces a caller's query key with the signed-in
 * user, so different users occupy disjoint key spaces in the shared cache.
 * User B structurally cannot hit user A's cached entry — no clearing needed,
 * no cross-user leak possible. Applied inside every OpenChoreo cache seam
 * (`useOpenChoreoQuery`, `useOpenChoreoInfiniteQuery`, `useOpenChoreoMutation`,
 * `useOpenChoreoCache`) so all 4 agree on the same namespaced key for a given
 * caller key — critical because mutations/`useOpenChoreoCache` invalidate and
 * read BY that key.
 *
 * Outside an {@link OpenChoreoQueryProvider} the scope is the pending sentinel
 * (still a valid, consistent namespace), so the seam degrades safely.
 */
export function useUserScopedKey(): (key: QueryKey) => QueryKey {
  const user = useContext(UserScopeContext) ?? PENDING_USER;
  // Stable per user so callers can safely list it in useMemo/useCallback deps
  // (e.g. useOpenChoreoCache memoises its handle on it).
  return useCallback((key: QueryKey) => ['@user', user, ...key], [user]);
}

/**
 * Resolves the signed-in user's entityRef and publishes it on
 * {@link UserScopeContext}. `identityApi` is a stable singleton, so this runs
 * once on mount; `getBackstageIdentity()` is a local token decode that resolves
 * near-instantly for an already-signed-in user (the app is always behind
 * sign-in before OpenChoreo content renders).
 */
const UserScopeProvider = ({ children }: PropsWithChildren<{}>) => {
  const identityApi = useApi(identityApiRef);
  const [user, setUser] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    identityApi
      .getBackstageIdentity()
      .then(({ userEntityRef }) => {
        if (!cancelled) setUser(userEntityRef);
      })
      .catch(() => {
        // No resolvable identity yet; keys stay under the pending sentinel
        // until a later successful resolve (which remounts nothing — the
        // context value simply updates).
      });
    return () => {
      cancelled = true;
    };
  }, [identityApi]);

  return (
    <UserScopeContext.Provider value={user}>
      {children}
    </UserScopeContext.Provider>
  );
};

/**
 * Wraps children in the OpenChoreo-wide `QueryClientProvider` (see
 * {@link queryClient}) plus the user-scoping context. Each OpenChoreo NFS
 * feature mounts this around its own extensions via `PluginWrapperBlueprint`
 * (not `AppRootWrapperBlueprint`, whose `app/root` input is internal and
 * silently ignores plugin-contributed wrappers), so NFS-mounted OpenChoreo
 * surfaces — auto-mounted entity tabs/cards and standalone plugin pages — are
 * self-contained: hosts wire nothing and always have a `QueryClient` in the
 * tree. A host that composes tab components itself via legacy
 * `EntityLayout.Route` JSX renders them outside this wrapper and mounts this
 * provider directly instead (as this repo's `packages/app` does).
 *
 * Cross-user isolation is structural, not imperative: every cache key is
 * namespaced by the signed-in user (see {@link useUserScopedKey}), so a user
 * switch moves into a disjoint key space and can never read the previous user's
 * cached data. No cache-clearing guard is needed.
 *
 * Nesting is safe. When a host installs several OpenChoreo plugins, each
 * contributes one wrapper and they nest — but every wrapper references the same
 * `queryClient` singleton, so the inner providers are harmless no-ops and there
 * is exactly one cache.
 */
export const OpenChoreoQueryProvider = ({
  children,
}: PropsWithChildren<{}>) => (
  <QueryClientProvider client={queryClient}>
    <UserScopeProvider>{children}</UserScopeProvider>
  </QueryClientProvider>
);
