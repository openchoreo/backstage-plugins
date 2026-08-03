import { renderHook, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useEnvironmentPipelines } from './useEnvironmentPipelines';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Environment',
  metadata: {
    name: 'staging-env',
    annotations: {
      [CHOREO_ANNOTATIONS.ENVIRONMENT]: 'staging',
      [CHOREO_ANNOTATIONS.NAMESPACE]: 'ns-1',
    },
  },
};

jest.mock('@backstage/plugin-catalog-react', () => ({
  ...jest.requireActual('@backstage/plugin-catalog-react'),
  useEntity: () => ({ entity }),
}));

const mockCatalogApi = { getEntities: jest.fn() };

function renderHookWithApi() {
  return renderHook(() => useEnvironmentPipelines(), {
    wrapper: createQueryWrapper([[catalogApiRef, mockCatalogApi as any]]),
  });
}

beforeEach(() => jest.clearAllMocks());

describe('useEnvironmentPipelines', () => {
  it('starts loading with no pipelines and exposes the environment name', () => {
    mockCatalogApi.getEntities.mockReturnValue(new Promise(() => {}));
    const { result } = renderHookWithApi();

    expect(result.current.loading).toBe(true);
    expect(result.current.pipelines).toEqual([]);
    expect(result.current.environmentName).toBe('staging');
    expect(result.current.isRefetching).toBe(false);
  });

  it('returns pipelines that include the current environment, with its index', async () => {
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [
        {
          metadata: { name: 'default-pipeline', namespace: 'ns-1' },
          spec: {
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
          },
        },
        {
          // Does not reference the staging environment → excluded.
          metadata: { name: 'other-pipeline', namespace: 'ns-1' },
          spec: {
            promotionPaths: [
              {
                sourceEnvironmentRef: 'qa',
                targetEnvironmentRefs: [{ name: 'canary' }],
              },
            ],
          },
        },
      ],
    });

    const { result } = renderHookWithApi();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.pipelines).toHaveLength(1);
    const pipeline = result.current.pipelines[0];
    expect(pipeline.pipelineName).toBe('default-pipeline');
    expect(pipeline.pipelineEntityRef).toBe(
      'deploymentpipeline:ns-1/default-pipeline',
    );
    expect(pipeline.environments).toEqual(['dev', 'staging', 'production']);
    expect(pipeline.currentIndex).toBe(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('returns an empty list when no pipeline references the environment', async () => {
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [
        {
          metadata: { name: 'unrelated', namespace: 'ns-1' },
          spec: {
            promotionPaths: [
              {
                sourceEnvironmentRef: 'qa',
                targetEnvironmentRefs: [{ name: 'canary' }],
              },
            ],
          },
        },
      ],
    });

    const { result } = renderHookWithApi();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.pipelines).toEqual([]);
  });
});
