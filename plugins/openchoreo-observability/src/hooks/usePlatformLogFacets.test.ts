import { renderHook } from '@testing-library/react';
import { deriveFacets, usePlatformLogFacets } from './usePlatformLogFacets';
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

const selections = (over: Partial<PlatformLogsFilters> = {}) => {
  const { clusterInstances, namespaces, podNames, containerNames } =
    filters(over);
  return { clusterInstances, namespaces, podNames, containerNames };
};

describe('deriveFacets', () => {
  it('offers every value present in the records', () => {
    const facets = deriveFacets(
      [
        entry({ namespaceName: 'ns-a', podName: 'pod-a1' }),
        entry({ namespaceName: 'ns-b', podName: 'pod-b1' }),
      ],
      selections(),
    );

    expect(facets.namespaces).toEqual(['ns-a', 'ns-b']);
    expect(facets.podNames).toEqual(['pod-a1', 'pod-b1']);
    expect(facets.clusterInstances).toEqual(['cluster1']);
    expect(facets.containerNames).toEqual(['manager']);
  });

  it('lists each value once however many records carry it', () => {
    const facets = deriveFacets(
      [entry({ podName: 'pod-a1' }), entry({ podName: 'pod-a1' })],
      selections(),
    );

    expect(facets.podNames).toEqual(['pod-a1']);
  });

  it('omits absent coordinates rather than offering an empty option', () => {
    const facets = deriveFacets(
      [entry({ clusterInstance: undefined, containerName: '' })],
      selections(),
    );

    expect(facets.clusterInstances).toEqual([]);
    expect(facets.containerNames).toEqual([]);
  });

  // A selection can name something the rows do not: a pod that has not logged inside
  // the window, or one arriving from a shared link. Without it in the list the picker
  // holds a selection it does not show, and there is no way to untick it.
  it('offers an applied value the records do not contain', () => {
    const facets = deriveFacets(
      [entry({ podName: 'pod-a1' })],
      selections({ podNames: ['pod-never-logged'] }),
    );

    expect(facets.podNames).toEqual(['pod-a1', 'pod-never-logged']);
  });

  it('does not duplicate an applied value the records do contain', () => {
    const facets = deriveFacets(
      [entry({ namespaceName: 'ns-a' })],
      selections({ namespaces: ['ns-a'] }),
    );

    expect(facets.namespaces).toEqual(['ns-a']);
  });

  it('sorts each list so the pickers are stable between renders', () => {
    const facets = deriveFacets(
      [
        entry({ namespaceName: 'ns-c' }),
        entry({ namespaceName: 'ns-a' }),
        entry({ namespaceName: 'ns-b' }),
      ],
      selections(),
    );

    expect(facets.namespaces).toEqual(['ns-a', 'ns-b', 'ns-c']);
  });

  it('offers nothing before any logs have loaded', () => {
    expect(deriveFacets([], selections())).toEqual({
      clusterInstances: [],
      namespaces: [],
      podNames: [],
      containerNames: [],
    });
  });
});

describe('usePlatformLogFacets', () => {
  // The bug this guards: the options used to accumulate across fetches, so narrowing
  // by a label selector left every pod from the previous scope still on offer.
  it('tracks the current results rather than accumulating', () => {
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
    expect(result.current.namespaces).toEqual(['ns-a', 'ns-b']);

    rerender({ logs: [entry({ namespaceName: 'ns-a' })] });

    expect(result.current.namespaces).toEqual(['ns-a']);
  });

  // Every coordinate is recomputed, not just the one that changed: a narrower label
  // selector returns different pods and containers too.
  it('recomputes every coordinate when the results change', () => {
    const { result, rerender } = renderHook(
      ({ logs }) => usePlatformLogFacets(logs, filters()),
      {
        initialProps: {
          logs: [
            entry({
              clusterInstance: 'cluster1',
              namespaceName: 'openchoreo-control-plane',
              podName: 'controller-manager-abc',
              containerName: 'manager',
            }),
          ],
        },
      },
    );

    rerender({
      logs: [
        entry({
          clusterInstance: 'cluster2',
          namespaceName: 'openchoreo-data-plane',
          podName: 'gateway-xyz',
          containerName: 'envoy',
        }),
      ],
    });

    expect(result.current).toEqual({
      clusterInstances: ['cluster2'],
      namespaces: ['openchoreo-data-plane'],
      podNames: ['gateway-xyz'],
      containerNames: ['envoy'],
    });
  });

  it('keeps an applied value on offer while a fetch returns nothing', () => {
    const { result } = renderHook(() =>
      usePlatformLogFacets([], filters({ podNames: ['pod-a1'] })),
    );

    expect(result.current.podNames).toEqual(['pod-a1']);
  });
});
