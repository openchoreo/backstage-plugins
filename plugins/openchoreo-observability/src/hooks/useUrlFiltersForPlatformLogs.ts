import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  DEFAULT_PLATFORM_LABEL_SELECTOR,
  DEFAULT_PLATFORM_LOG_FIELDS,
  PLATFORM_LOG_LEVELS,
  PlatformLogField,
  PlatformLogsFilters,
} from '../components/PlatformLogs/types';
import { parseUrlTimeRange, writeUrlTimeRange } from '../utils/urlTimeRange';

const parseList = (raw: string | null): string[] =>
  raw
    ? raw
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
    : [];

/**
 * Manages platform logs filters synced to URL query parameters, so a filtered view is a
 * shareable permalink. That is the reason the endpoint is a GET, and the reason the
 * page keeps no filter state of its own.
 *
 * Query parameters:
 * - `plane`: full entity ref of the observability plane (the observer to query)
 * - `cluster`, `ns`, `pod`, `container`: comma-separated filter lists
 * - `labels`: Kubernetes label selector; defaults to the control plane, and an explicit
 *   empty value (`labels=`) means "search everything" rather than "use the default"
 * - `logLevel`: comma-separated levels; absent means all
 * - `timeRange` + `from`/`to`, `search`, `fields`
 * - `sort`: `desc` for newest first; absent means the oldest-first default
 * - `live`: tail for new entries; ignored on a custom (absolute) time range
 */
export function useUrlFiltersForPlatformLogs() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<PlatformLogsFilters>(() => {
    const { timeRange, customStartTime, customEndTime } =
      parseUrlTimeRange(searchParams);

    const logLevelParam = searchParams.get('logLevel');
    const logLevel =
      logLevelParam === null
        ? [...PLATFORM_LOG_LEVELS]
        : PLATFORM_LOG_LEVELS.filter(level =>
            new Set(parseList(logLevelParam)).has(level),
          );

    // Oldest first by default: a platform log is usually read forwards, from the
    // first sign of trouble onwards, so the page opens at the start of the window.
    const rawSortOrder = searchParams.get('sort');
    const sortOrder: 'asc' | 'desc' = rawSortOrder === 'desc' ? 'desc' : 'asc';

    // Absent means "use the default"; present-but-empty means the operator cleared it
    // to search everything the plane holds. Collapsing those two would make the
    // default impossible to get rid of.
    const rawLabels = searchParams.get('labels');
    const labels =
      rawLabels === null ? DEFAULT_PLATFORM_LABEL_SELECTOR : rawLabels;

    const fieldsParam = searchParams.get('fields');
    const parsedFields = parseList(fieldsParam).filter(f =>
      Object.values(PlatformLogField).includes(f as PlatformLogField),
    ) as PlatformLogField[];
    // The message column is the point of the page; never let it be deselected away.
    const selectedFields = parsedFields.length
      ? Array.from(new Set([...parsedFields, PlatformLogField.Log]))
      : DEFAULT_PLATFORM_LOG_FIELDS;

    return {
      observabilityPlane: searchParams.get('plane') || '',
      clusterInstances: parseList(searchParams.get('cluster')),
      namespaces: parseList(searchParams.get('ns')),
      podNames: parseList(searchParams.get('pod')),
      containerNames: parseList(searchParams.get('container')),
      labels,
      logLevel,
      timeRange,
      customStartTime,
      customEndTime,
      searchQuery: searchParams.get('search') || undefined,
      sortOrder,
      selectedFields,
      // Only relative ranges can tail: a custom range has a fixed upper bound, so
      // re-running it returns the same rows forever.
      isLive: searchParams.get('live') === 'true' && timeRange !== 'custom',
    };
  }, [searchParams]);

  const updateFilters = useCallback(
    (next: Partial<PlatformLogsFilters>) => {
      const params = new URLSearchParams(searchParams);

      const setList = (key: string, values: string[] | undefined) => {
        if (values === undefined) return;
        if (values.length) params.set(key, values.join(','));
        else params.delete(key);
      };

      if (next.observabilityPlane !== undefined) {
        if (next.observabilityPlane)
          params.set('plane', next.observabilityPlane);
        else params.delete('plane');
      }
      setList('cluster', next.clusterInstances);
      setList('ns', next.namespaces);
      setList('pod', next.podNames);
      setList('container', next.containerNames);
      setList('fields', next.selectedFields);

      // Written even when empty: `labels=` is how the operator says "no label filter",
      // which is different from having never touched it.
      if (next.labels !== undefined) {
        params.set('labels', next.labels);
      }

      if (next.logLevel !== undefined) {
        if (next.logLevel.length === PLATFORM_LOG_LEVELS.length) {
          params.delete('logLevel');
        } else {
          params.set('logLevel', next.logLevel.join(','));
        }
      }

      writeUrlTimeRange(params, next);

      if (next.searchQuery !== undefined) {
        if (next.searchQuery) params.set('search', next.searchQuery);
        else params.delete('search');
      }
      // Only the non-default direction is written, so a default view keeps a clean URL.
      if (next.sortOrder !== undefined) {
        if (next.sortOrder === 'desc') params.set('sort', 'desc');
        else params.delete('sort');
      }

      if (next.isLive !== undefined) {
        if (next.isLive) params.set('live', 'true');
        else params.delete('live');
      }
      // Switching to a custom range silently stops tailing; leaving live=true in the
      // URL would show a Live button that is on but never updates.
      if (next.timeRange === 'custom') {
        params.delete('live');
      }

      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return { filters, updateFilters };
}
