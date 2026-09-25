import { renderHook, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useDeploymentPipeline } from './useDeploymentPipeline';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'System',
  metadata: {
    name: 'proj-1',
    namespace: 'default',
    annotations: { [CHOREO_ANNOTATIONS.NAMESPACE]: 'ns-1' },
  },
};

jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  useEntity: () => ({ entity }),
}));

function renderUseDeploymentPipeline(
  fetchDeploymentPipeline: jest.Mock,
  getEntities: jest.Mock = jest.fn().mockResolvedValue({ items: [] }),
) {
  const client = { fetchDeploymentPipeline } as any;
  return renderHook(() => useDeploymentPipeline(), {
    wrapper: createQueryWrapper([
      [openChoreoClientApiRef, client],
      [catalogApiRef, { getEntities } as any],
    ]),
  });
}

describe('useDeploymentPipeline', () => {
  it('starts loading with no data', () => {
    const { result } = renderUseDeploymentPipeline(
      jest.fn().mockReturnValue(new Promise(() => {})),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('builds ordered environments and promotion paths from the pipeline', async () => {
    const fetchDeploymentPipeline = jest.fn().mockResolvedValue({
      name: 'default-pipeline',
      displayName: 'Default Pipeline',
      promotionPaths: [
        {
          sourceEnvironmentRef: 'dev',
          targetEnvironmentRefs: [{ name: 'staging' }],
        },
        {
          sourceEnvironmentRef: 'staging',
          targetEnvironmentRefs: [{ name: 'production' }],
        },
      ],
    });
    const { result } = renderUseDeploymentPipeline(fetchDeploymentPipeline);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetchDeploymentPipeline).toHaveBeenCalledWith('proj-1', 'ns-1');
    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.name).toBe('Default Pipeline');
    expect(result.current.data!.resourceName).toBe('default-pipeline');
    expect(result.current.data!.environments).toEqual([
      'dev',
      'staging',
      'production',
    ]);
    expect(result.current.data!.promotionPaths).toEqual([
      { source: 'dev', targets: [{ name: 'staging' }] },
      { source: 'staging', targets: [{ name: 'production' }] },
    ]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  describe('deployment hooks', () => {
    // Bindings live on the target Environment; the pipeline only names it.
    // A stale `hooks` on the pipeline target must not be drawn.
    const pipeline = {
      name: 'gated',
      namespaceName: 'ns-1',
      promotionPaths: [
        {
          sourceEnvironmentRef: 'staging',
          targetEnvironmentRefs: [
            {
              name: 'production',
              hooks: {
                preDeploy: [
                  { name: 'stale', hookRef: { kind: 'Hook', name: 'stale' } },
                ],
              },
            },
          ],
        },
      ],
    };
    const environments = {
      items: [
        {
          metadata: { name: 'production' },
          spec: {
            hooks: {
              preDeploy: [
                {
                  name: 'e2e-test',
                  hookRef: { kind: 'ClusterHook', name: 'e2e-test' },
                },
              ],
            },
          },
        },
      ],
    };

    it("returns each environment's bindings, keyed by environment, for the pipeline lanes", async () => {
      const getEntities = jest.fn().mockResolvedValue(environments);
      const { result } = renderUseDeploymentPipeline(
        jest.fn().mockResolvedValue(pipeline),
        getEntities,
      );

      await waitFor(() =>
        expect(result.current.data?.environmentHooks).toEqual({
          production: [
            {
              key: 'pre-e2e-test',
              name: 'e2e-test',
              phase: 'pre',
              // CRD default for a pre-deploy Sync hook is onFailure=Block.
              effect: 'blocks',
              to: '/catalog/openchoreo-cluster/clusterhook/e2e-test',
            },
          ],
        }),
      );
      // Paths carry no hooks: hooks belong to environments, not promotions.
      expect(result.current.data!.promotionPaths).toEqual([
        { source: 'staging', targets: [{ name: 'production' }] },
      ]);
      // Environments are looked up in the project's catalog namespace.
      expect(getEntities).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { kind: 'Environment', 'metadata.namespace': 'default' },
        }),
      );
    });
  });

  it('surfaces a fetch failure as an error', async () => {
    const fetchDeploymentPipeline = jest
      .fn()
      .mockRejectedValue(new Error('pipeline down'));
    const { result } = renderUseDeploymentPipeline(fetchDeploymentPipeline);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeTruthy();
  });
});
