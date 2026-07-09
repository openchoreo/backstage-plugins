import { useCallback } from 'react';
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';

/** Options for {@link useOpenChoreoMutation}. */
export interface UseOpenChoreoMutationOptions<TArgs extends unknown[], TData> {
  /**
   * Query keys to invalidate after the mutation succeeds — the cache equivalent
   * of the hand-rolled `await fetchX()` that used to follow every write. Every
   * cached query whose key starts with one of these is marked stale and
   * refetched; the mutation promise does not resolve until the invalidation is
   * issued, so callers still have fresh data in flight by the time they await.
   */
  invalidates?: QueryKey[];
  /** Called after a successful mutation, with the result and the call args. May be async. */
  onSuccess?: (data: TData, args: TArgs) => void | Promise<void>;
  /** Called after a failed mutation, with the error and the call args. May be async. */
  onError?: (error: Error, args: TArgs) => void | Promise<void>;
}

/** What {@link useOpenChoreoMutation} returns. */
export interface UseOpenChoreoMutationResult<TArgs extends unknown[], TData> {
  /**
   * Run the mutation. Resolves with the mutation's return value (may be `void`)
   * and **re-throws** on failure — so existing `try { await mutate() } catch`
   * blocks that surface an error toast keep working unchanged.
   */
  mutate: (...args: TArgs) => Promise<TData>;
  /** True while the mutation is in flight. */
  isLoading: boolean;
  /** The last error, or `null`. */
  error: Error | null;
  /** Reset error/loading state back to idle. */
  reset: () => void;
}

/**
 * The mutation counterpart to `useOpenChoreoQuery`: a thin wrapper over TanStack
 * Query's `useMutation` that replaces the repo's hand-rolled
 * "call `client.verb()` then `await fetchX()`" pattern.
 *
 * It keeps the two behaviours existing call sites depend on: `mutate` **resolves
 * with the result** (some mutations return the created entity, some return
 * `void`) and **re-throws on error** (components catch it to show a toast). After
 * a success it invalidates the `invalidates` query keys — so every component
 * showing that data refreshes from one call, instead of each write hook owning a
 * manual refetch. TanStack also drops state updates after unmount, replacing the
 * manual `mountedRef` guards some action hooks carry today.
 *
 * @example
 * ```ts
 * const { mutate: deleteRole } = useOpenChoreoMutation(
 *   (name: string) => client.deleteClusterRole(name),
 *   { invalidates: [['cluster-roles']] },
 * );
 * // in the component:
 * try { await deleteRole(name); showSuccess('Deleted'); }
 * catch (e) { showError(getErrorMessage(e)); }
 * ```
 */
export function useOpenChoreoMutation<TArgs extends unknown[], TData>(
  mutationFn: (...args: TArgs) => Promise<TData>,
  opts: UseOpenChoreoMutationOptions<TArgs, TData> = {},
): UseOpenChoreoMutationResult<TArgs, TData> {
  const queryClient = useQueryClient();
  const { invalidates, onSuccess, onError } = opts;

  const mutation = useMutation<TData, Error, TArgs>({
    // Args are passed as a single tuple so the generic arg list is preserved.
    mutationFn: (args: TArgs) => mutationFn(...args),
    onSuccess: async (data, args) => {
      if (invalidates?.length) {
        await Promise.all(
          invalidates.map(queryKey =>
            queryClient.invalidateQueries({ queryKey }),
          ),
        );
      }
      // Await so a rejection from an async handler surfaces through mutateAsync
      // rather than becoming an unhandled promise.
      await onSuccess?.(data, args);
    },
    onError: async (error, args) => {
      await onError?.(error, args);
    },
  });

  const { mutateAsync, isPending, error, reset } = mutation;

  const mutate = useCallback(
    // mutateAsync already rejects on error, so the re-throw is inherited; we
    // just adapt the variadic call site to the tuple mutationFn.
    (...args: TArgs) => mutateAsync(args),
    [mutateAsync],
  );

  return {
    mutate,
    isLoading: isPending,
    error: error ?? null,
    reset,
  };
}
