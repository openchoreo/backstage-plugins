import { useApi } from '@backstage/core-plugin-api';
import {
  calculateTimeRange,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../api/ObservabilityApi';
import {
  PLATFORM_LOG_LEVELS,
  PlatformLogFilterName,
  PlatformLogFilterValue,
  PlatformLogFilterValuesResponse,
  PlatformLogsFilters,
} from '../components/PlatformLogs/types';

/**
 * Options change far more slowly than logs do, and the client default of `staleTime: 0`
 * would re-ask on every reopen of the same picker.
 */
const FILTER_VALUES_STALE_MS = 60_000;

export interface UsePlatformLogFilterValuesResult {
  /**
   * The values the observer offers, or `null` when it cannot answer - an observer
   * predating the endpoint, a logs adapter that cannot aggregate, a failed request, or
   * simply nothing asked for yet. `null` means "unknown", never "nothing matches": an
   * empty array is a real answer, and only `null` sends the caller to its fallback.
   */
  values: PlatformLogFilterValue[] | null;
  loading: boolean;
  /**
   * Reported for diagnosis, not for display. A failure here already falls back to the
   * derived values, and the page renders any real observer problem above the filters -
   * a second error surface inside a dropdown would only repeat it.
   */
  error: string | null;
}

/**
 * Lists the values one platform logs filter can take, across everything matching the
 * current query rather than only the page of records on screen.
 *
 * One filter per request, because each costs the observer an aggregation - so this is
 * asked for the picker that is open, and is idle (`filter === null`) the rest of the
 * time.
 *
 * The query is sent whole, the named filter's own selections included. The observer
 * ignores those when counting: a `podName` list counted under a selected pod would
 * offer that pod alone, with no way back to the others.
 */
export function usePlatformLogFilterValues(
  observerUrl: string | undefined,
  filter: PlatformLogFilterName | null,
  filters: PlatformLogsFilters,
  valueSearch: string = '',
): UsePlatformLogFilterValuesResult {
  const observabilityApi = useApi(observabilityApiRef);

  // Mirrors usePlatformLogs: every level selected is the same query as no level filter,
  // and none selected matches no record at all, so there is nothing to count.
  const allLevels = filters.logLevel.length === PLATFORM_LOG_LEVELS.length;
  const noLevels = filters.logLevel.length === 0;
  const logLevels = allLevels ? undefined : filters.logLevel;

  const { data, loading, error } =
    useOpenChoreoQuery<PlatformLogFilterValuesResponse | null>(
      [
        'platform-log-filter-values',
        observerUrl ?? '',
        filter ?? '',
        filters.clusterInstances.join(','),
        filters.namespaces.join(','),
        filters.podNames.join(','),
        filters.containerNames.join(','),
        filters.labels,
        (logLevels ?? []).join(','),
        filters.searchQuery ?? '',
        // The window is keyed by what the user chose, not by what it resolves to: a
        // relative range resolves to a new endTime on every render and would key a fresh
        // query each time. It is resolved inside the fetcher instead.
        filters.timeRange,
        filters.customStartTime,
        filters.customEndTime,
        valueSearch,
      ],
      async () => {
        const { startTime, endTime } = calculateTimeRange(filters.timeRange, {
          startTime: filters.customStartTime,
          endTime: filters.customEndTime,
        });

        const response = await observabilityApi.getPlatformLogFilterValues(
          observerUrl!,
          {
            filter: filter!,
            clusterInstances: filters.clusterInstances,
            namespaces: filters.namespaces,
            podNames: filters.podNames,
            containerNames: filters.containerNames,
            labels: filters.labels || undefined,
            logLevels,
            searchQuery: filters.searchQuery,
            valueSearch: valueSearch || undefined,
            startTime,
            endTime,
          },
        );
        return response;
      },
      {
        enabled: !!observerUrl && filter !== null && !noLevels,
        staleTime: FILTER_VALUES_STALE_MS,
        // Typing narrows the list a keystroke at a time; blanking it between fetches
        // would make the picker flicker under the cursor.
        keepPreviousData: true,
        // A picker is open in front of someone. Falling back at once beats making them
        // watch a backoff, and neither answer this can fail with improves on a retry.
        retry: false,
      },
    );

  // keepPreviousData hands back the last answer while a new one loads, and that answer
  // may describe the picker opened before this one. The response echoes the filter it
  // answered for precisely so it can be told apart; without this check, opening Pods
  // straight after Namespaces briefly lists namespaces under the Pods label.
  //
  // The level check is not the same thing. Every level selected and none selected both
  // send no level filter, so they key alike, and the disabled no-level query reads the
  // all-level answer straight out of the cache - values for records the table is not
  // even showing. Keying them apart would not help while keepPreviousData is offering
  // the previous answer anyway, so the answer is refused here instead.
  const answered = !noLevels && data && data.filter === filter ? data : null;

  return {
    values: answered ? answered.values : null,
    loading,
    error: error ? error.message || 'Failed to load filter values' : null,
  };
}
