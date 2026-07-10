import { renderHook, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useEnvironments } from './useEnvironments';

const systemEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'url-shortener',
    annotations: { [CHOREO_ANNOTATIONS.NAMESPACE]: 'ns-1' },
  },
};

const mockCatalogApi = { getEntities: jest.fn() };

function renderUseEnvironments(entity: Entity = systemEntity) {
  return renderHook(() => useEnvironments(entity), {
    wrapper: createQueryWrapper([[catalogApiRef, mockCatalogApi as any]]),
  });
}

beforeEach(() => jest.clearAllMocks());

describe('useEnvironments', () => {
  it('starts loading with no environments', () => {
    mockCatalogApi.getEntities.mockReturnValue(new Promise(() => {}));
    const { result } = renderUseEnvironments();

    expect(result.current.loading).toBe(true);
    expect(result.current.environments).toEqual([]);
    expect(result.current.isRefetching).toBe(false);
  });

  it('maps Environment catalog entities to the return shape', async () => {
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [
        {
          metadata: {
            name: 'prod-env',
            title: 'Production',
            annotations: {
              [CHOREO_ANNOTATIONS.ENVIRONMENT]: 'production',
              'openchoreo.io/dns-prefix': 'prod',
              'openchoreo.io/is-production': 'true',
            },
          },
        },
      ],
    });
    const { result } = renderUseEnvironments();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments).toEqual([
      {
        name: 'production',
        displayName: 'Production',
        dnsPrefix: 'prod',
        isProduction: true,
      },
    ]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('returns an empty list without a catalog hit when namespace is missing', async () => {
    const noNs: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'System',
      metadata: { name: 'url-shortener', annotations: {} },
    };
    const { result } = renderUseEnvironments(noNs);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments).toEqual([]);
    expect(mockCatalogApi.getEntities).not.toHaveBeenCalled();
  });
});
