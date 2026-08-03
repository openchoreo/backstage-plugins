import { renderHook, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useEnvironmentDeployedComponents } from './useEnvironmentDeployedComponents';

const environmentEntity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Environment',
  metadata: {
    name: 'prod-env',
    annotations: {
      [CHOREO_ANNOTATIONS.ENVIRONMENT]: 'production',
      [CHOREO_ANNOTATIONS.NAMESPACE]: 'ns-1',
    },
  },
};

const mockCatalogApi = { getEntities: jest.fn() };

function renderHookWithApis(client: any, entity: Entity = environmentEntity) {
  return renderHook(() => useEnvironmentDeployedComponents(entity), {
    wrapper: createQueryWrapper([
      [openChoreoClientApiRef, client],
      [catalogApiRef, mockCatalogApi as any],
    ]),
  });
}

beforeEach(() => jest.clearAllMocks());

describe('useEnvironmentDeployedComponents', () => {
  it('starts loading with empty components and a zeroed summary', () => {
    mockCatalogApi.getEntities.mockReturnValue(new Promise(() => {}));
    const client = { fetchReleaseBindings: jest.fn() };
    const { result } = renderHookWithApis(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.components).toEqual([]);
    expect(result.current.statusSummary).toEqual({
      healthy: 0,
      degraded: 0,
      failed: 0,
      pending: 0,
      total: 0,
    });
    expect(result.current.isRefetching).toBe(false);
  });

  it('collects deployed components and summarises their status', async () => {
    // 1st call: systems in namespace. 2nd call: components in the project.
    mockCatalogApi.getEntities
      .mockResolvedValueOnce({
        items: [{ metadata: { name: 'proj-1' } }],
      })
      .mockResolvedValueOnce({
        items: [
          {
            metadata: {
              name: 'checkout',
              namespace: 'ns-1',
              title: 'Checkout',
              annotations: { [CHOREO_ANNOTATIONS.COMPONENT]: 'checkout' },
            },
          },
        ],
      });

    const client = {
      fetchReleaseBindings: jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              environment: 'production',
              status: 'ready',
              releaseName: 'release-1',
              endpoints: [{ name: 'http' }],
            },
          ],
        },
      }),
    };

    const { result } = renderHookWithApis(client);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.components).toEqual([
      {
        name: 'checkout',
        displayName: 'Checkout',
        entityRef: 'component:ns-1/checkout',
        projectName: 'proj-1',
        releaseVersion: 'release-1',
        status: 'Ready',
        endpoints: 1,
      },
    ]);
    expect(result.current.statusSummary).toEqual({
      healthy: 1,
      degraded: 0,
      failed: 0,
      pending: 0,
      total: 1,
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('returns empty without catalog hits when namespace is missing', async () => {
    const noNs: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Environment',
      metadata: {
        name: 'prod-env',
        annotations: { [CHOREO_ANNOTATIONS.ENVIRONMENT]: 'production' },
      },
    };
    const client = { fetchReleaseBindings: jest.fn() };
    const { result } = renderHookWithApis(client, noNs);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.components).toEqual([]);
    expect(mockCatalogApi.getEntities).not.toHaveBeenCalled();
  });
});
