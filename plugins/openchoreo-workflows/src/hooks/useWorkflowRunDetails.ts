import { useApi } from '@backstage/core-plugin-api';
import { NotFoundError } from '@backstage/errors';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { genericWorkflowsClientApiRef } from '../api';
import type { WorkflowRun } from '../types';
import { useSelectedNamespace } from '../context';

interface UseWorkflowRunDetailsResult {
  run: WorkflowRun | null;
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const POLLING_INTERVAL = 5000; // 5 seconds
// After triggering, the WorkflowRun CR may not exist yet. Retry 404s for up
// to this many attempts (at 2 s apart) before surfacing the error.
const NOT_FOUND_RETRY_INTERVAL = 2000;
const NOT_FOUND_MAX_RETRIES = 5;

/** Sleep `ms`, rejecting early if the query's AbortSignal fires (unmount/supersede). */
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

/** True while the run is still active (Pending or Running) — drives the poll. */
function isActive(run?: WorkflowRun | null): boolean {
  const status = (run?.phase || run?.status)?.toLowerCase();
  return status === 'pending' || status === 'running';
}

/**
 * Hook to fetch details of a specific workflow run.
 * Automatically polls for updates when the run is active.
 * Must be used within a NamespaceProvider.
 *
 * @param runName - The name of the workflow run to fetch details for
 * @param namespaceName - Explicit namespace override. Falls back to the NamespaceContext value
 *   (the entity's annotation namespace). Pass this explicitly for ClusterWorkflow runs whose
 *   namespace is user-selected and differs from the entity's context namespace.
 */
export function useWorkflowRunDetails(
  runName: string,
  namespaceName?: string,
): UseWorkflowRunDetailsResult {
  const client = useApi(genericWorkflowsClientApiRef);
  const contextNamespace = useSelectedNamespace();
  const resolvedNamespace = namespaceName ?? contextNamespace;

  const { data, loading, isRefetching, error, refetch } =
    useOpenChoreoQuery<WorkflowRun>(
      ['workflow-run-details', resolvedNamespace ?? null, runName],
      async ({ signal }) => {
        // A newly triggered WorkflowRun may not be visible immediately; retry the
        // 404 a few times before surfacing it (kept inside the fetcher so the
        // query stays in its loading state throughout the retry window). The
        // backoff waits on the query's AbortSignal, so navigating away mid-retry
        // stops the loop instead of hammering the backend for the full window.
        for (let attempt = 0; ; attempt++) {
          try {
            return await client.getWorkflowRun(resolvedNamespace!, runName);
          } catch (err) {
            if (
              err instanceof NotFoundError &&
              attempt < NOT_FOUND_MAX_RETRIES
            ) {
              await wait(NOT_FOUND_RETRY_INTERVAL, signal);
              continue;
            }
            throw err;
          }
        }
      },
      {
        enabled: !!resolvedNamespace && !!runName,
        refetchInterval: query =>
          isActive(query.state.data) ? POLLING_INTERVAL : false,
        // The fetcher owns the 404 retry/backoff loop; disable the global retry so
        // it can't run the ~10s NotFound loop twice (~20s stuck loading).
        retry: false,
      },
    );

  return {
    run: data ?? null,
    loading,
    isRefetching,
    error,
    refetch: async () => {
      await refetch();
    },
  };
}
