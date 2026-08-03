import { renderHook, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
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

function renderUseDeploymentPipeline(fetchDeploymentPipeline: jest.Mock) {
  const client = { fetchDeploymentPipeline } as any;
  return renderHook(() => useDeploymentPipeline(), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
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
