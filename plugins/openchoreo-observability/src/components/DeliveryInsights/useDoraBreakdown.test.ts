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
      useDoraBreakdown('domain', { namespace: 'acme-prod' }, 30, 'daily'),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments).toEqual(['dev', 'prod']);
    // Env cards are driven off the same list, so an empty list silently empties
    // the section rather than erroring.
    expect(result.current.envRows.map(r => r.name)).toEqual(['dev', 'prod']);
  });
});
