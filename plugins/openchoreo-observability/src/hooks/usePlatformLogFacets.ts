import { useMemo } from 'react';
import {
  PlatformLogEntry,
  PlatformLogsFilters,
} from '../components/PlatformLogs/types';

/** The options offered by each coordinate filter. */
export interface PlatformLogFacets {
  clusterInstances: string[];
  namespaces: string[];
  podNames: string[];
  containerNames: string[];
}

/** Each coordinate filter, paired with the record field it reads. */
const COORDINATES = [
  { facet: 'clusterInstances', field: 'clusterInstance' },
  { facet: 'namespaces', field: 'namespaceName' },
  { facet: 'podNames', field: 'podName' },
  { facet: 'containerNames', field: 'containerName' },
] as const satisfies ReadonlyArray<{
  facet: keyof PlatformLogFacets;
  field: keyof PlatformLogEntry;
}>;

/**
 * Derives each filter's options from the records in hand, plus whatever is applied.
 *
 * The rows are already the query's answer, so they need no further narrowing: every
 * record present matches every filter set, which is what makes selecting a namespace
 * narrow the pod and container lists for free.
 *
 * Applied values are unioned in because they need not appear in the rows at all - a
 * pod that has not logged inside the window, or one arriving from a shared link.
 * Without them a picker would hold a selection it does not list, leaving no way to
 * untick it.
 *
 * Exported for tests.
 */
export function deriveFacets(
  logs: PlatformLogEntry[],
  filters: Pick<PlatformLogsFilters, keyof PlatformLogFacets>,
): PlatformLogFacets {
  const facets = {} as PlatformLogFacets;

  for (const { facet, field } of COORDINATES) {
    const values = new Set<string>(filters[facet]);
    for (const log of logs) {
      const value = log[field];
      if (typeof value === 'string' && value !== '') values.add(value);
    }
    facets[facet] = [...values].sort((a, b) => a.localeCompare(b));
  }

  return facets;
}

/**
 * Offers the coordinates present in the loaded logs as filter options, recomputed on
 * every fetch so the pickers describe the results on screen.
 *
 * A stand-in until the observer exposes facet counts, and it inherits that limit: the
 * options are only ever what the current query returned. Narrowing on one coordinate
 * therefore leaves that coordinate offering just the value picked, since the rows hold
 * nothing else - reaching a sibling means clearing the filter or typing the value,
 * which is why the pickers stay free-text as well as selectable.
 */
export function usePlatformLogFacets(
  logs: PlatformLogEntry[],
  filters: PlatformLogsFilters,
): PlatformLogFacets {
  const { clusterInstances, namespaces, podNames, containerNames } = filters;

  return useMemo(
    () =>
      deriveFacets(logs, {
        clusterInstances,
        namespaces,
        podNames,
        containerNames,
      }),
    [logs, clusterInstances, namespaces, podNames, containerNames],
  );
}
