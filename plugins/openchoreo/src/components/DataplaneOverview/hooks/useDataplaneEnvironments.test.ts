import { renderHook, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useDataplaneEnvironments } from './useDataplaneEnvironments';

const dataplaneEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'DataPlane',
  metadata: {
    name: 'dp-1',
    annotations: { [CHOREO_ANNOTATIONS.NAMESPACE]: 'ns-1' },
  },
};

const mockCatalogApi = { getEntities: jest.fn() };

function renderUseDataplaneEnvironments(entity: Entity = dataplaneEntity) {
  return renderHook(() => useDataplaneEnvironments(entity), {
    wrapper: createQueryWrapper([[catalogApiRef, mockCatalogApi as any]]),
  });
}

beforeEach(() => jest.clearAllMocks());

describe('useDataplaneEnvironments', () => {
  it('starts loading with no environments', () => {
    mockCatalogApi.getEntities.mockReturnValue(new Promise(() => {}));
    const { result } = renderUseDataplaneEnvironments();

    expect(result.current.loading).toBe(true);
    expect(result.current.environments).toEqual([]);
    expect(result.current.isRefetching).toBe(false);
  });

  it('maps environments that reference this dataplane', async () => {
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [
        {
          metadata: {
            name: 'prod-env',
            namespace: 'ns-1',
            title: 'Production',
            annotations: {
              [CHOREO_ANNOTATIONS.ENVIRONMENT]: 'production',
              'openchoreo.io/data-plane-ref': 'dp-1',
              'openchoreo.io/is-production': 'true',
            },
          },
        },
        {
          metadata: {
            name: 'other-env',
            annotations: { 'openchoreo.io/data-plane-ref': 'dp-2' },
          },
        },
      ],
    });
    const { result } = renderUseDataplaneEnvironments();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments).toEqual([
      {
        name: 'production',
        displayName: 'Production',
        entityRef: 'environment:ns-1/prod-env',
        isProduction: true,
        componentCount: 0,
        healthStatus: 'unknown',
      },
    ]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('returns empty without a catalog hit when namespace is missing', async () => {
    const noNs: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'DataPlane',
      metadata: { name: 'dp-1', annotations: {} },
    };
    const { result } = renderUseDataplaneEnvironments(noNs);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments).toEqual([]);
    expect(mockCatalogApi.getEntities).not.toHaveBeenCalled();
  });
});
