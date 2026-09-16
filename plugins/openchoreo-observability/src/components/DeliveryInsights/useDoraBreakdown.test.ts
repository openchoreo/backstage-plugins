import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useDoraBreakdown } from './useDoraBreakdown';
import { observabilityApiRef } from '../../api/ObservabilityApi';
import type { DoraMetricsResponse } from '../../types';

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: jest.fn(),
}));

const getEntities = jest.fn();
const getDoraMetrics = jest.fn();

// Stable objects: the hook's effect lists both apis in its dependencies, so a
// fresh object per render would re-run it forever.
const catalogApi = { getEntities };
const observabilityApi = { getDoraMetrics };

(useApi as jest.Mock).mockImplementation(ref => {
  if (ref === catalogApiRef) return catalogApi;
  if (ref === observabilityApiRef) return observabilityApi;
  throw new Error('unexpected api ref');
});

const summary = (total: number) =>
  ({
    summary: { deploymentFrequency: { total } },
  } as unknown as DoraMetricsResponse);

/** Environment entities as the catalog module writes them: in the OpenChoreo
 *  namespace *and* annotated with it. */
const envEntity = (name: string, namespace: string) => ({
  kind: 'Environment',
  metadata: {
    name,
    namespace,
    annotations: { [CHOREO_ANNOTATIONS.NAMESPACE]: namespace },
  },
});

describe('useDoraBreakdown', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getDoraMetrics.mockResolvedValue(summary(1));
  });

  // `translateEnvironmentToEntity` puts Environment entities *in* the OpenChoreo
  // namespace (`metadata.namespace`), unlike Systems and Components which live in
  // it only by annotation. Querying by namespace is what the rest of the plugin
  // does (see CostInsights' `useNamespaceEnvironments`), and it has to keep
  // working for a namespace other than `default`.
  it('finds the environments of a non-default namespace', async () => {
    getEntities.mockImplementation(async ({ filter }: any) => {
      if (filter.kind === 'Environment') {
        return {
          items:
            filter['metadata.namespace'] === 'acme-prod'
              ? [envEntity('dev', 'acme-prod'), envEntity('prod', 'acme-prod')]
              : [],
        };
      }
      return { items: [] };
    });

    const { result } = renderHook(() =>
      useDoraBreakdown(
        'domain',
        { namespace: 'acme-prod', environment: 'dev' },
        30,
        'daily',
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments).toEqual(['dev', 'prod']);
    // Env cards are driven off the same list, so an empty list silently empties
    // the section rather than erroring.
    expect(result.current.envRows.map(r => r.name)).toEqual(['dev', 'prod']);
  });

  // The cards render off envRows alone -- they take no loading or error prop --
  // so rows left over from the previous scope would sit under the new headline
  // numbers, or stay on screen if the new request failed.
  describe('rows belong to the query that produced them', () => {
    const envsFor =
      (namespace: string) =>
      async ({ filter }: any) => {
        if (filter.kind === 'Environment') {
          return {
            items:
              filter['metadata.namespace'] === namespace
                ? [envEntity('dev', namespace)]
                : [],
          };
        }
        return { items: [] };
      };

    it('drops the previous scope rows before the new request lands', async () => {
      getEntities.mockImplementation(envsFor('ns-a'));
      const { result, rerender } = renderHook(
        ({ ns }: { ns: string }) =>
          useDoraBreakdown(
            'domain',
            { namespace: ns, environment: 'dev' },
            30,
            'daily',
          ),
        { initialProps: { ns: 'ns-a' } },
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.envRows).toHaveLength(1);

      // A slow second scope: the rows must go as the request starts, not when
      // it finishes.
      let release: (v: any) => void = () => {};
      getEntities.mockImplementation(
        () => new Promise(resolve => (release = resolve)),
      );
      rerender({ ns: 'ns-b' });

      await waitFor(() => expect(result.current.loading).toBe(true));
      expect(result.current.envRows).toEqual([]);
      expect(result.current.rows).toEqual([]);
      release({ items: [] });
    });

    it('does not leave the previous scope rows up when the request fails', async () => {
      getEntities.mockImplementation(envsFor('ns-a'));
      const { result, rerender } = renderHook(
        ({ ns }: { ns: string }) =>
          useDoraBreakdown(
            'domain',
            { namespace: ns, environment: 'dev' },
            30,
            'daily',
          ),
        { initialProps: { ns: 'ns-a' } },
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.envRows).toHaveLength(1);

      getEntities.mockRejectedValue(new Error('catalog unavailable'));
      rerender({ ns: 'ns-b' });

      await waitFor(() =>
        expect(result.current.error).toBe('catalog unavailable'),
      );
      expect(result.current.envRows).toEqual([]);
    });

    it('keeps the rows up across a refetch of the same query', async () => {
      getEntities.mockImplementation(envsFor('ns-a'));
      const { result } = renderHook(() =>
        useDoraBreakdown(
          'domain',
          { namespace: 'ns-a', environment: 'dev' },
          30,
          'daily',
        ),
      );
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.envRows).toHaveLength(1);

      // Refresh asks the same question again; blanking the page for it would be
      // a worse answer than the one already on screen.
      result.current.refetch();
      expect(result.current.envRows).toHaveLength(1);
      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.envRows).toHaveLength(1);
    });
  });

  // The environment list is a property of the namespace. Carried across a
  // namespace change it offers -- and the page auto-selects -- an environment
  // that belongs somewhere else.
  it('drops the environment list when the namespace changes', async () => {
    getEntities.mockImplementation(async ({ filter }: any) => {
      if (filter.kind === 'Environment') {
        return {
          items:
            filter['metadata.namespace'] === 'ns-a'
              ? [envEntity('dev-a', 'ns-a')]
              : [],
        };
      }
      return { items: [] };
    });
    const { result, rerender } = renderHook(
      ({ ns }: { ns: string }) =>
        useDoraBreakdown(
          'domain',
          { namespace: ns, environment: 'dev-a' },
          30,
          'daily',
        ),
      { initialProps: { ns: 'ns-a' } },
    );
    await waitFor(() => expect(result.current.environments).toEqual(['dev-a']));

    let release: (v: any) => void = () => {};
    getEntities.mockImplementation(
      () => new Promise(resolve => (release = resolve)),
    );
    rerender({ ns: 'ns-b' });

    await waitFor(() => expect(result.current.environments).toEqual([]));
    release({ items: [] });
  });

  // Every metric below a namespace or project is scoped to one environment, so
  // none is requested until the caller has settled on one. Unscoped it would ask
  // for figures aggregated across observability planes that no observer answers
  // for, and be replaced a moment later anyway.
  it('does not request child summaries before an environment is settled', async () => {
    getEntities.mockImplementation(async ({ filter }: any) => {
      if (filter.kind === 'Environment') {
        return { items: [envEntity('dev', 'ns-a')] };
      }
      return { items: [{ kind: 'System', metadata: { name: 'checkout' } }] };
    });

    const { result, rerender } = renderHook(
      ({ env }: { env?: string }) =>
        useDoraBreakdown(
          'domain',
          { namespace: 'ns-a', environment: env },
          30,
          'daily',
        ),
      { initialProps: {} as { env?: string } },
    );

    await waitFor(() => expect(result.current.environments).toEqual(['dev']));
    expect(getDoraMetrics).not.toHaveBeenCalled();

    // Once the caller settles on one, the summaries are fetched.
    rerender({ env: 'dev' });
    await waitFor(() => expect(getDoraMetrics).toHaveBeenCalled());
  });
});
