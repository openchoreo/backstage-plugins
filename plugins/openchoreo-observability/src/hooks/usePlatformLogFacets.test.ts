import { renderHook } from '@testing-library/react';
import { mergeFacets, usePlatformLogFacets } from './usePlatformLogFacets';
import { PlatformLogEntry } from '../components/PlatformLogs/types';

const entry = (over: Partial<PlatformLogEntry> = {}): PlatformLogEntry => ({
  timestamp: '2026-08-14T16:31:00Z',
  log: 'x',
  clusterInstance: 'cluster1',
  namespaceName: 'openchoreo-control-plane',
  podName: 'controller-manager-abc',
  containerName: 'manager',
  ...over,
});

const EMPTY = {
  clusterInstances: [],
  namespaces: [],
  podNames: [],
  containerNames: [],
};

describe('mergeFacets', () => {
  it('collects the distinct values of each coordinate', () => {
    const facets = mergeFacets(EMPTY, [
      entry(),
      entry({ podName: 'openchoreo-api-xyz', containerName: 'api' }),
    ]);

    expect(facets.clusterInstances).toEqual(['cluster1']);
    expect(facets.podNames).toEqual([
      'controller-manager-abc',
      'openchoreo-api-xyz',
    ]);
    expect(facets.containerNames).toEqual(['api', 'manager']);
  });

  it('sorts values so the pickers are stable between renders', () => {
    const facets = mergeFacets(EMPTY, [
      entry({ namespaceName: 'thunder' }),
      entry({ namespaceName: 'cert-manager' }),
      entry({ namespaceName: 'openbao' }),
    ]);

    expect(facets.namespaces).toEqual(['cert-manager', 'openbao', 'thunder']);
  });

  it('ignores absent and empty values', () => {
    const facets = mergeFacets(EMPTY, [
      { timestamp: 't', log: 'x' },
      entry({ clusterInstance: '' }),
    ]);

    expect(facets.clusterInstances).toEqual([]);
  });

  // Load-bearing: the hook feeds this back into state from an effect that depends on
  // the result, so a fresh object when nothing changed would loop forever.
  it('returns the same reference when nothing is new', () => {
    const first = mergeFacets(EMPTY, [entry()]);
    const second = mergeFacets(first, [entry()]);

    expect(second).toBe(first);
  });

  it('adds to what is already known rather than replacing it', () => {
    const first = mergeFacets(EMPTY, [entry({ namespaceName: 'a' })]);
    const second = mergeFacets(first, [entry({ namespaceName: 'b' })]);

    expect(second.namespaces).toEqual(['a', 'b']);
  });
});

describe('usePlatformLogFacets', () => {
  // The reason values accumulate instead of being recomputed: once a namespace is
  // selected the results only contain that namespace, so a recomputed pool would offer
  // it as the only option and there would be no way back to the others.
  it('keeps values that have dropped out of the current results', () => {
    const { result, rerender } = renderHook(
      ({ logs }) => usePlatformLogFacets(logs, 'default'),
      {
        initialProps: {
          logs: [entry({ namespaceName: 'a' }), entry({ namespaceName: 'b' })],
        },
      },
    );
    expect(result.current.namespaces).toEqual(['a', 'b']);

    // The user filtered down to namespace "a"; "b" must still be offered.
    rerender({ logs: [entry({ namespaceName: 'a' })] });

    expect(result.current.namespaces).toEqual(['a', 'b']);
  });

  it('discards the pool when the observability plane changes', () => {
    const { result, rerender } = renderHook(
      ({ logs, plane }) => usePlatformLogFacets(logs, plane),
      {
        initialProps: {
          logs: [entry({ clusterInstance: 'cluster1' })],
          plane: 'default',
        },
      },
    );
    expect(result.current.clusterInstances).toEqual(['cluster1']);

    // Another plane describes different clusters and pods entirely.
    rerender({
      logs: [entry({ clusterInstance: 'cluster2' })],
      plane: 'eu-plane',
    });

    expect(result.current.clusterInstances).toEqual(['cluster2']);
  });

  it('starts empty before any logs have loaded', () => {
    const { result } = renderHook(() => usePlatformLogFacets([], 'default'));

    expect(result.current).toEqual(EMPTY);
  });
});
