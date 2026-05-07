import { useEffect, useMemo } from 'react';
import type {
  ModelsBuild,
  ModelsCompleteComponent,
} from '@openchoreo/backstage-plugin-common';
import { useWorkflowData } from './useWorkflowData';

/** Failure heuristic — kept in sync with BuildStatusChip. */
const isFailedStatus = (status?: string) => {
  const lowered = (status ?? '').toLowerCase();
  return lowered.includes('fail') || lowered.includes('error');
};

/** Pick the most recent build by createdAt (ISO string compare is ordered). */
const pickLatest = (builds: ModelsBuild[]): ModelsBuild | undefined => {
  if (!builds.length) return undefined;
  return [...builds].sort((a, b) =>
    (b.createdAt ?? '').localeCompare(a.createdAt ?? ''),
  )[0];
};

export type LatestFailedRunResult = {
  builds: ModelsBuild[];
  componentDetails: ModelsCompleteComponent | null;
  latestRun: ModelsBuild | undefined;
  isFailed: boolean;
  loading: boolean;
  error: Error | null;
};

/**
 * Reports whether the most recent workflow run for the current entity
 * (component) is in a failed state.
 *
 * Reuses {@link useWorkflowData} (which already polls active builds at
 * 5 s) and adds an idle 30 s refresh so a brand-new failure shows up
 * without requiring a manual reload.
 */
export function useLatestFailedRun(): LatestFailedRunResult {
  const { builds, componentDetails, loading, error, fetchBuilds } =
    useWorkflowData();
  const hasActiveBuilds = useMemo(
    () =>
      builds.some(build => {
        const status = build.status?.toLowerCase() ?? '';
        return (
          status.includes('pending') ||
          status.includes('running') ||
          status.includes('progress')
        );
      }),
    [builds],
  );

  // Background refresh while there are no active builds — useWorkflowData
  // only polls when something is pending/running, but we also want to
  // catch newly-finished failures.
  //
  // Self-scheduling setTimeout loop (NOT setInterval): each iteration
  // awaits fetchBuilds() before scheduling the next, so a slow network
  // or throttled API can never queue overlapping fetches on top of each
  // other. ``cancelled`` + ``clearTimeout`` together ensure that an
  // unmount mid-flight neither re-schedules nor leaks a pending timer.
  useEffect(() => {
    if (hasActiveBuilds) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (cancelled) return;
      try {
        await fetchBuilds();
      } catch (err) {
        // Log instead of silently swallowing — token expiry / 5xx /
        // network errors are otherwise invisible. Don't bubble up: a
        // transient failure shouldn't break the polling loop.
        // eslint-disable-next-line no-console
        console.warn('useLatestFailedRun: background refresh failed', err);
      }
      if (cancelled) return;
      timeoutId = setTimeout(tick, 30_000);
    };

    timeoutId = setTimeout(tick, 30_000);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [fetchBuilds, hasActiveBuilds]);

  const latestRun = useMemo(() => pickLatest(builds), [builds]);
  const isFailed = useMemo(
    () => isFailedStatus(latestRun?.status),
    [latestRun],
  );

  return {
    builds,
    componentDetails,
    latestRun,
    isFailed,
    loading,
    error,
  };
}
