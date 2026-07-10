import { renderHook, waitFor, act } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useClusterDataplaneEnvironments } from './useClusterDataplaneEnvironments';

const dataplaneEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'ClusterDataPlane',
  metadata: { name: 'cdp-1' },
};

const mockCatalogApi = { getEntities: jest.fn() };

function renderHookWithApi() {
  return renderHook(() => useClusterDataplaneEnvironments(dataplaneEntity), {
    wrapper: createQueryWrapper([[catalogApiRef, mockCatalogApi as any]]),
  });
}

beforeEach(() => jest.clearAllMocks());

describe('useClusterDataplaneEnvironments', () => {
  it('starts loading with no environments', () => {
    mockCatalogApi.getEntities.mockReturnValue(new Promise(() => {}));
    const { result } = renderHookWithApi();

    expect(result.current.loading).toBe(true);
    expect(result.current.environments).toEqual([]);
    expect(result.current.isRefetching).toBe(false);
  });

  it('maps only environments that reference this cluster dataplane', async () => {
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [
        {
          metadata: {
            name: 'dev-env',
            namespace: 'ns-1',
            title: 'Dev',
            annotations: {
              [CHOREO_ANNOTATIONS.ENVIRONMENT]: 'development',
              'openchoreo.io/data-plane-ref': 'cdp-1',
            },
          },
        },
        {
          metadata: {
            name: 'other-env',
            annotations: { 'openchoreo.io/data-plane-ref': 'cdp-2' },
          },
        },
      ],
    });
    const { result } = renderHookWithApi();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments).toEqual([
      {
        name: 'development',
        displayName: 'Dev (ns-1)',
        entityRef: 'environment:ns-1/dev-env',
        isProduction: false,
        componentCount: 0,
        healthStatus: 'unknown',
      },
    ]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('refresh re-runs the catalog query', async () => {
    mockCatalogApi.getEntities.mockResolvedValue({ items: [] });
    const { result } = renderHookWithApi();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockCatalogApi.getEntities).toHaveBeenCalledTimes(1);

    await act(async () => {
      result.current.refresh();
    });

    await waitFor(() =>
      expect(mockCatalogApi.getEntities).toHaveBeenCalledTimes(2),
    );
  });
});
