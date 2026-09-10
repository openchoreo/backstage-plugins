import { renderHook } from '@testing-library/react';
import {
  CoordinateIndex,
  deriveFacets,
  EMPTY_INDEX,
  mergeCoordinates,
  pruneDescendantSelections,
  scopeKey,
  usePlatformLogFacets,
} from './usePlatformLogFacets';
import {
  DEFAULT_PLATFORM_LOG_FIELDS,
  PLATFORM_LOG_LEVELS,
  PlatformLogEntry,
  PlatformLogsFilters,
} from '../components/PlatformLogs/types';

const entry = (over: Partial<PlatformLogEntry> = {}): PlatformLogEntry => ({
  timestamp: '2026-08-14T16:31:00Z',
  log: 'x',
  clusterInstance: 'cluster1',
  namespaceName: 'openchoreo-control-plane',
  podName: 'controller-manager-abc',
  containerName: 'manager',
  ...over,
});

const filters = (
  over: Partial<PlatformLogsFilters> = {},
): PlatformLogsFilters => ({
  observabilityPlane: 'default',
  selectedFields: DEFAULT_PLATFORM_LOG_FIELDS,
  clusterInstances: [],
  namespaces: [],
  podNames: [],
  containerNames: [],
  labels: '',
  logLevel: [...PLATFORM_LOG_LEVELS],
  timeRange: '10m',
  sortOrder: 'desc',
  ...over,
});

/** An index built from the given records, for the derivation tests. */
const indexOf = (logs: PlatformLogEntry[]): CoordinateIndex =>
  mergeCoordinates(EMPTY_INDEX, logs);

/** Two namespaces, two pods each, distinct containers. */
const twoNamespaces = indexOf([
  entry({ namespaceName: 'ns-a', podName: 'pod-a1', containerName: 'c-a1' }),
  entry({ namespaceName: 'ns-a', podName: 'pod-a2', containerName: 'c-a2' }),
  entry({ namespaceName: 'ns-b', podName: 'pod-b1', containerName: 'c-b1' }),
]);

describe('mergeCoordinates', () => {
  it('records one tuple per distinct coordinate combination', () => {
    const index = mergeCoordinates(EMPTY_INDEX, [
      entry(),
      entry(),
      entry({ containerName: 'sidecar' }),
    ]);

    expect(index.size).toBe(2);
  });

  // Load-bearing: the hook feeds this back into state from an effect that depends on
  // the result, so a fresh Map when nothing changed would loop forever.
  it('returns the same reference when nothing is new', () => {
    const first = mergeCoordinates(EMPTY_INDEX, [entry()]);
    const second = mergeCoordinates(first, [entry()]);

    expect(second).toBe(first);
  });

  it('adds to what is already known rather than replacing it', () => {
    const first = mergeCoordinates(EMPTY_INDEX, [entry({ podName: 'p1' })]);
    const second = mergeCoordinates(first, [entry({ podName: 'p2' })]);

    expect(second.size).toBe(2);
  });

  it('keeps a record whose coordinates are partly absent', () => {
    const index = mergeCoordinates(EMPTY_INDEX, [
      { timestamp: 't', log: 'x', namespaceName: 'ns-a' },
    ]);

    expect([...index.values()][0]).toEqual({
      cluster: '',
      namespace: 'ns-a',
      pod: '',
      container: '',
    });
  });
});

describe('deriveFacets', () => {
  it('offers every value when nothing is selected', () => {
    const facets = deriveFacets(twoNamespaces, filters());

    expect(facets.namespaces).toEqual(['ns-a', 'ns-b']);
    expect(facets.podNames).toEqual(['pod-a1', 'pod-a2', 'pod-b1']);
  });

  // The bug this whole change exists to fix.
  it('narrows pods and containers to the selected namespace', () => {
    const facets = deriveFacets(
      twoNamespaces,
      filters({ namespaces: ['ns-a'] }),
    );

    expect(facets.podNames).toEqual(['pod-a1', 'pod-a2']);
    expect(facets.containerNames).toEqual(['c-a1', 'c-a2']);
  });

  // The invariant that makes narrowing safe. Narrowing a level by its own selection
  // would be circular: ns-a would become the only namespace on offer, with no way back
  // to ns-b.
  it('does not narrow a level by its own selection', () => {
    const facets = deriveFacets(
      twoNamespaces,
      filters({ namespaces: ['ns-a'] }),
    );

    expect(facets.namespaces).toEqual(['ns-a', 'ns-b']);
  });

  it('narrows containers by the selected pod as well', () => {
    const facets = deriveFacets(
      twoNamespaces,
      filters({ namespaces: ['ns-a'], podNames: ['pod-a1'] }),
    );

    expect(facets.containerNames).toEqual(['c-a1']);
  });

  it('unions the ancestors when several are selected', () => {
    const facets = deriveFacets(
      twoNamespaces,
      filters({ namespaces: ['ns-a', 'ns-b'] }),
    );

    expect(facets.podNames).toEqual(['pod-a1', 'pod-a2', 'pod-b1']);
  });

  it('never narrows clusters, which sit at the top', () => {
    const index = indexOf([
      entry({ clusterInstance: 'cluster1', namespaceName: 'ns-a' }),
      entry({ clusterInstance: 'cluster2', namespaceName: 'ns-b' }),
    ]);

    const facets = deriveFacets(
      index,
      filters({ clusterInstances: ['cluster1'] }),
    );

    expect(facets.clusterInstances).toEqual(['cluster1', 'cluster2']);
    expect(facets.namespaces).toEqual(['ns-a']);
  });

  // Records collected before the cluster stamp landed carry ''. They do not match a
  // selected cluster in the API, so they must not contribute options here either.
  it('excludes unstamped records once a cluster is selected', () => {
    const index = indexOf([
      entry({ clusterInstance: 'cluster1', namespaceName: 'ns-a' }),
      entry({ clusterInstance: '', namespaceName: 'ns-legacy' }),
    ]);

    expect(deriveFacets(index, filters()).namespaces).toEqual([
      'ns-a',
      'ns-legacy',
    ]);
    expect(
      deriveFacets(index, filters({ clusterInstances: ['cluster1'] }))
        .namespaces,
    ).toEqual(['ns-a']);
  });

  it('omits absent values rather than offering an empty option', () => {
    const index = indexOf([
      { timestamp: 't', log: 'x', namespaceName: 'ns-a' },
    ]);

    expect(deriveFacets(index, filters()).podNames).toEqual([]);
  });

  it('sorts each level so the pickers are stable between renders', () => {
    const index = indexOf([
      entry({ namespaceName: 'thunder' }),
      entry({ namespaceName: 'cert-manager' }),
      entry({ namespaceName: 'openbao' }),
    ]);

    expect(deriveFacets(index, filters()).namespaces).toEqual([
      'cert-manager',
      'openbao',
      'thunder',
    ]);
  });
});

describe('pruneDescendantSelections', () => {
  it('passes a patch through untouched when no ancestor level changed', () => {
    const patch = { searchQuery: 'boom' };

    expect(pruneDescendantSelections(filters(), patch, twoNamespaces)).toEqual(
      patch,
    );
  });

  it('drops a pod that the new namespace puts out of reach', () => {
    const current = filters({ namespaces: ['ns-a'], podNames: ['pod-a1'] });

    const pruned = pruneDescendantSelections(
      current,
      { namespaces: ['ns-b'] },
      twoNamespaces,
    );

    expect(pruned).toEqual({ namespaces: ['ns-b'], podNames: [] });
  });

  // Adding a namespace must not cost a pod that is still valid under the first one.
  it('keeps a pod still reachable after a namespace is added', () => {
    const current = filters({ namespaces: ['ns-a'], podNames: ['pod-a1'] });

    const pruned = pruneDescendantSelections(
      current,
      { namespaces: ['ns-a', 'ns-b'] },
      twoNamespaces,
    );

    expect(pruned).toEqual({ namespaces: ['ns-a', 'ns-b'] });
  });

  it('prunes every descendant at once, not just the next level', () => {
    const current = filters({
      namespaces: ['ns-a'],
      podNames: ['pod-a1'],
      containerNames: ['c-a1'],
    });

    const pruned = pruneDescendantSelections(
      current,
      { namespaces: ['ns-b'] },
      twoNamespaces,
    );

    expect(pruned.podNames).toEqual([]);
    expect(pruned.containerNames).toEqual([]);
  });

  // These options come from observed rows and are incomplete by construction, so
  // absence is not proof of invalidity. Without this guard, adding a namespace before
  // any logs had loaded would wipe a pod filter.
  it('keeps selections when the pool knows nothing yet', () => {
    const current = filters({ namespaces: ['ns-a'], podNames: ['pod-a1'] });

    const pruned = pruneDescendantSelections(
      current,
      { namespaces: ['ns-b'] },
      EMPTY_INDEX,
    );

    expect(pruned).toEqual({ namespaces: ['ns-b'] });
  });

  it('leaves ancestors alone when a descendant changes', () => {
    const current = filters({ namespaces: ['ns-a'] });

    const pruned = pruneDescendantSelections(
      current,
      { podNames: ['pod-a1'] },
      twoNamespaces,
    );

    expect(pruned).toEqual({ podNames: ['pod-a1'] });
  });
});

describe('scopeKey', () => {
  it('ignores the coordinate selections', () => {
    // Those are what deriveFacets narrows by; resetting on them would throw away the
    // tuples a level needs to offer a way back to its other options.
    expect(
      scopeKey(
        filters({
          clusterInstances: ['cluster1'],
          namespaces: ['ns-a'],
          podNames: ['pod-a1'],
          containerNames: ['c-a1'],
        }),
      ),
    ).toBe(scopeKey(filters()));
  });

  it.each([
    ['the plane', { observabilityPlane: 'eu-plane' }],
    ['the label selector', { labels: 'openchoreo.dev/plane=dataplane' }],
    ['the search phrase', { searchQuery: 'reconcile failed' }],
    ['the level set', { logLevel: ['ERROR'] }],
    ['the time range', { timeRange: '24h' }],
    ['a custom window edge', { customStartTime: '2026-08-14T00:00:00Z' }],
  ])('changes when %s changes', (_name, over) => {
    expect(scopeKey(filters(over))).not.toBe(scopeKey(filters()));
  });

  it('is unchanged by sort order, columns and tailing', () => {
    // None of these alter which coordinates the query can return, so resetting on them
    // would only throw the pool away for nothing.
    expect(
      scopeKey(filters({ sortOrder: 'asc', selectedFields: [], isLive: true })),
    ).toBe(scopeKey(filters()));
  });
});

describe('usePlatformLogFacets', () => {
  // The reason tuples accumulate instead of being recomputed: once a namespace is
  // selected the results only contain that namespace, so a recomputed pool would offer
  // it as the only option with no way back to the others.
  it('keeps values that have dropped out of the current results', () => {
    const { result, rerender } = renderHook(
      ({ logs }) => usePlatformLogFacets(logs, filters()),
      {
        initialProps: {
          logs: [
            entry({ namespaceName: 'ns-a' }),
            entry({ namespaceName: 'ns-b' }),
          ],
        },
      },
    );
    expect(result.current.facets.namespaces).toEqual(['ns-a', 'ns-b']);

    rerender({ logs: [entry({ namespaceName: 'ns-a' })] });

    expect(result.current.facets.namespaces).toEqual(['ns-a', 'ns-b']);
  });

  it('narrows as soon as a selection changes, without waiting for a fetch', () => {
    const logs = [
      entry({ namespaceName: 'ns-a', podName: 'pod-a1' }),
      entry({ namespaceName: 'ns-b', podName: 'pod-b1' }),
    ];
    const { result, rerender } = renderHook(
      ({ f }) => usePlatformLogFacets(logs, f),
      { initialProps: { f: filters() } },
    );
    expect(result.current.facets.podNames).toEqual(['pod-a1', 'pod-b1']);

    // The rows for ns-b are still loaded; the list narrows from history regardless.
    rerender({ f: filters({ namespaces: ['ns-a'] }) });

    expect(result.current.facets.podNames).toEqual(['pod-a1']);
  });

  it('discards the pool when the observability plane changes', () => {
    const { result, rerender } = renderHook(
      ({ logs, plane }) =>
        usePlatformLogFacets(logs, filters({ observabilityPlane: plane })),
      {
        initialProps: {
          logs: [entry({ clusterInstance: 'cluster1' })],
          plane: 'default',
        },
      },
    );
    expect(result.current.facets.clusterInstances).toEqual(['cluster1']);

    rerender({
      logs: [entry({ clusterInstance: 'cluster2' })],
      plane: 'eu-plane',
    });

    expect(result.current.facets.clusterInstances).toEqual(['cluster2']);
  });

  it('discards the pool when the label selector changes', () => {
    const { result, rerender } = renderHook(
      ({ logs, labels }) => usePlatformLogFacets(logs, filters({ labels })),
      {
        initialProps: {
          logs: [entry({ podName: 'controlplane-pod' })],
          labels: 'openchoreo.dev/plane=controlplane',
        },
      },
    );
    expect(result.current.facets.podNames).toEqual(['controlplane-pod']);

    rerender({
      logs: [entry({ podName: 'dataplane-pod' })],
      labels: 'openchoreo.dev/plane=dataplane',
    });

    expect(result.current.facets.podNames).toEqual(['dataplane-pod']);
  });

  it('keeps the pool while tailing a relative range', () => {
    // Live polling re-runs the same query, so the window moving underneath it must not
    // count as a new scope - the pickers would flicker on every poll.
    const { result, rerender } = renderHook(
      ({ logs, isLive }) => usePlatformLogFacets(logs, filters({ isLive })),
      {
        initialProps: {
          logs: [entry({ podName: 'pod-a1' })],
          isLive: true,
        },
      },
    );
    expect(result.current.facets.podNames).toEqual(['pod-a1']);

    rerender({ logs: [entry({ podName: 'pod-a2' })], isLive: true });

    expect(result.current.facets.podNames).toEqual(['pod-a1', 'pod-a2']);
  });

  it('starts empty before any logs have loaded', () => {
    const { result } = renderHook(() => usePlatformLogFacets([], filters()));

    expect(result.current.facets).toEqual({
      clusterInstances: [],
      namespaces: [],
      podNames: [],
      containerNames: [],
    });
    expect(result.current.index.size).toBe(0);
  });
});
