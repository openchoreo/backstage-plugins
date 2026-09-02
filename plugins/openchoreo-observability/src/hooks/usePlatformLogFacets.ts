import { useEffect, useState } from 'react';
import { PlatformLogEntry } from '../components/PlatformLogs/types';

/** Distinct values seen for each of the coordinate filters. */
export interface PlatformLogFacets {
  clusterInstances: string[];
  namespaces: string[];
  podNames: string[];
  containerNames: string[];
}

const EMPTY: PlatformLogFacets = {
  clusterInstances: [],
  namespaces: [],
  podNames: [],
  containerNames: [],
};

const FIELDS: Array<[keyof PlatformLogFacets, keyof PlatformLogEntry]> = [
  ['clusterInstances', 'clusterInstance'],
  ['namespaces', 'namespaceName'],
  ['podNames', 'podName'],
  ['containerNames', 'containerName'],
];

/**
 * Folds the values in `logs` into `base`, returning `base` itself when nothing is new.
 *
 * Returning the same reference is load-bearing: the caller sets this into state from an
 * effect that depends on the result, so a fresh object every time would loop forever.
 *
 * Exported for tests.
 */
export function mergeFacets(
  base: PlatformLogFacets,
  logs: PlatformLogEntry[],
): PlatformLogFacets {
  const sets = new Map<keyof PlatformLogFacets, Set<string>>(
    FIELDS.map(([facet]) => [facet, new Set(base[facet])]),
  );

  let added = false;
  for (const log of logs) {
    for (const [facet, field] of FIELDS) {
      const value = log[field];
      if (
        typeof value === 'string' &&
        value !== '' &&
        !sets.get(facet)!.has(value)
      ) {
        sets.get(facet)!.add(value);
        added = true;
      }
    }
  }
  if (!added) return base;

  return FIELDS.reduce((acc, [facet]) => {
    acc[facet] = [...sets.get(facet)!].sort((a, b) => a.localeCompare(b));
    return acc;
  }, {} as PlatformLogFacets);
}

/**
 * Collects the distinct cluster / namespace / pod / container values seen in the logs
 * loaded so far, to populate the filter pickers.
 *
 * This is a stand-in until the observer exposes real facet counts. Two consequences the
 * pickers have to live with, and the reason they stay free-text as well as selectable:
 *
 *  - The pool only contains what has actually been fetched, so a pod that has not logged
 *    inside the current window is not offered. Typing it still works.
 *  - Values accumulate across pages and filter changes rather than being recomputed from
 *    the current result set. Recomputing would be circular - selecting one namespace
 *    would leave that namespace as the only option, with no way back to the others.
 *
 * The pool resets when `planeKey` changes, since another observability plane describes a
 * different set of clusters and pods.
 */
export function usePlatformLogFacets(
  logs: PlatformLogEntry[],
  planeKey: string,
): PlatformLogFacets {
  const [state, setState] = useState<{
    plane: string;
    facets: PlatformLogFacets;
  }>({ plane: planeKey, facets: EMPTY });

  useEffect(() => {
    setState(prev => {
      const samePlane = prev.plane === planeKey;
      const base = samePlane ? prev.facets : EMPTY;
      const facets = mergeFacets(base, logs);
      if (samePlane && facets === base) return prev;
      return { plane: planeKey, facets };
    });
  }, [logs, planeKey]);

  return state.facets;
}
