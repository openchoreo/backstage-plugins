import { useEffect, useMemo, useState } from 'react';
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

/**
 * One combination of coordinates seen on a record. An absent coordinate is '' rather than
 * undefined, so a tuple always compares and keys the same way.
 */
export interface CoordinateTuple {
  cluster: string;
  namespace: string;
  pod: string;
  container: string;
}

/** The distinct tuples observed so far, keyed for de-duplication. */
export type CoordinateIndex = ReadonlyMap<string, CoordinateTuple>;

export const EMPTY_INDEX: CoordinateIndex = new Map();

/**
 * The filter levels, outermost first. This order *is* the hierarchy: a level's options
 * are narrowed by the levels before it, and never by itself or those after it.
 */
const LEVELS = [
  {
    facet: 'clusterInstances',
    coordinate: 'cluster',
    field: 'clusterInstance',
  },
  { facet: 'namespaces', coordinate: 'namespace', field: 'namespaceName' },
  { facet: 'podNames', coordinate: 'pod', field: 'podName' },
  { facet: 'containerNames', coordinate: 'container', field: 'containerName' },
] as const satisfies ReadonlyArray<{
  facet: keyof PlatformLogFacets;
  coordinate: keyof CoordinateTuple;
  field: keyof PlatformLogEntry;
}>;

/** A Kubernetes name cannot contain a NUL, so this separator cannot collide. */
const KEY_SEPARATOR = '\u0000';

const tupleKey = (t: CoordinateTuple) =>
  [t.cluster, t.namespace, t.pod, t.container].join(KEY_SEPARATOR);

const str = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * Folds the coordinates in `logs` into `index`, returning `index` itself when nothing is
 * new.
 *
 * Returning the same reference is load-bearing: the caller sets this into state from an
 * effect that depends on the result, so a fresh Map every time would loop forever.
 *
 * Exported for tests.
 */
export function mergeCoordinates(
  index: CoordinateIndex,
  logs: PlatformLogEntry[],
): CoordinateIndex {
  let next: Map<string, CoordinateTuple> | null = null;

  for (const log of logs) {
    const tuple: CoordinateTuple = {
      cluster: str(log.clusterInstance),
      namespace: str(log.namespaceName),
      pod: str(log.podName),
      container: str(log.containerName),
    };
    const key = tupleKey(tuple);
    if (index.has(key) || next?.has(key)) continue;
    if (!next) next = new Map(index);
    next.set(key, tuple);
  }

  return next ?? index;
}

/**
 * Derives each filter's options from the observed tuples, narrowing every level by the
 * selections at the levels above it.
 *
 * A level is deliberately *not* narrowed by its own selection. Doing so would be
 * circular: picking one namespace leaves the result set containing only that namespace,
 * which would leave it as the only namespace on offer with no way back to the others.
 *
 * An empty selection means "match all" at that level, so the common single-cluster
 * install - where nobody ever picks a cluster - still gets full namespace and pod lists.
 *
 * Narrowing uses the same predicate the query does, so a list only ever offers values the
 * current query could actually return. That also settles records with no cluster stamp:
 * they carry '' and do not match a selected cluster here, exactly as they would not match
 * it in the API.
 *
 * Exported for tests.
 */
export function deriveFacets(
  index: CoordinateIndex,
  filters: Pick<
    PlatformLogsFilters,
    'clusterInstances' | 'namespaces' | 'podNames' | 'containerNames'
  >,
): PlatformLogFacets {
  const tuples = [...index.values()];
  const facets = {} as PlatformLogFacets;

  LEVELS.forEach(({ facet, coordinate }, depth) => {
    const ancestors = LEVELS.slice(0, depth);
    const values = new Set<string>();

    for (const tuple of tuples) {
      const matchesAncestors = ancestors.every(ancestor => {
        const selected = filters[ancestor.facet];
        return (
          selected.length === 0 || selected.includes(tuple[ancestor.coordinate])
        );
      });
      if (!matchesAncestors) continue;

      const value = tuple[coordinate];
      if (value !== '') values.add(value);
    }

    facets[facet] = [...values].sort((a, b) => a.localeCompare(b));
  });

  return facets;
}

/**
 * Removes descendant selections that a new ancestor selection puts out of reach, so
 * switching namespace does not leave a pod from the old one applied and the query
 * returning nothing.
 *
 * Two guards, both deliberate:
 *
 * Only a patch that changes an ancestor level prunes. New logs arriving never do, because
 * data must not rewrite the filters - opening a shared link whose pod has not logged
 * inside the time window would otherwise silently drop that filter and show broader
 * results than the sender saw.
 *
 * And a level is left alone when the pool knows nothing about it yet. These options come
 * from observed rows and are incomplete by construction, so absence is not proof of
 * invalidity; without this, merely adding a second namespace before any logs had loaded
 * would wipe a pod filter.
 *
 * Returns the patch extended with whatever had to be cleared, so the caller applies it as
 * one update and no intermediate state is ever invalid.
 *
 * Exported for tests.
 */
export function pruneDescendantSelections(
  current: PlatformLogsFilters,
  patch: Partial<PlatformLogsFilters>,
  index: CoordinateIndex,
): Partial<PlatformLogsFilters> {
  const changedDepth = LEVELS.findIndex(
    ({ facet }) => patch[facet] !== undefined,
  );
  if (changedDepth === -1) return patch;

  const merged: PlatformLogsFilters = { ...current, ...patch };
  const pruned: Partial<PlatformLogsFilters> = { ...patch };

  LEVELS.slice(changedDepth + 1).forEach(({ facet }) => {
    const selected = merged[facet];
    if (selected.length === 0) return;

    const available = deriveFacets(index, merged)[facet];
    if (available.length === 0) return;

    const kept = selected.filter(value => available.includes(value));
    if (kept.length !== selected.length) {
      pruned[facet] = kept;
      merged[facet] = kept;
    }
  });

  return pruned;
}

/**
 * Collects the coordinates seen in the logs loaded so far and offers them as filter
 * options, each level narrowed by the levels above it.
 *
 * This is a stand-in until the observer exposes real facet counts. The pool only contains
 * what has been fetched, so a pod that has not logged inside the current window is not
 * offered - which is why the pickers stay free-text as well as selectable.
 *
 * Tuples accumulate rather than being recomputed from the current result set, so a
 * namespace whose rows have scrolled out of view is still offered. The pool resets when
 * the observability plane changes, since another plane describes different clusters and
 * pods entirely.
 *
 * Returns the index alongside the options because pruning a stale selection needs it.
 */
export function usePlatformLogFacets(
  logs: PlatformLogEntry[],
  filters: PlatformLogsFilters,
): { facets: PlatformLogFacets; index: CoordinateIndex } {
  const planeKey = filters.observabilityPlane;

  const [state, setState] = useState<{
    plane: string;
    index: CoordinateIndex;
  }>({ plane: planeKey, index: EMPTY_INDEX });

  useEffect(() => {
    setState(prev => {
      const samePlane = prev.plane === planeKey;
      const base = samePlane ? prev.index : EMPTY_INDEX;
      const index = mergeCoordinates(base, logs);
      if (samePlane && index === base) return prev;
      return { plane: planeKey, index };
    });
  }, [logs, planeKey]);

  const { index } = state;
  const { clusterInstances, namespaces, podNames, containerNames } = filters;

  const facets = useMemo(
    () =>
      deriveFacets(index, {
        clusterInstances,
        namespaces,
        podNames,
        containerNames,
      }),
    [index, clusterInstances, namespaces, podNames, containerNames],
  );

  return { facets, index };
}
