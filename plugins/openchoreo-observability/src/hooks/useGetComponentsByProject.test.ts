import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useGetComponentsByProject } from './useGetComponentsByProject';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useGetComponentsByProject', () => {
  const getEntities = jest.fn();

  const entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'project-a',
      annotations: { 'openchoreo.io/namespace': 'dev' },
    },
    spec: { owner: 'group:default/team' },
  };

  const componentEntity = (name: string) => ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name,
      annotations: {
        'openchoreo.io/namespace': 'dev',
        'openchoreo.io/project': 'project-a',
      },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getEntities });
  });

  it('starts in loading state with empty data', () => {
    getEntities.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () => useGetComponentsByProject(entity as any),
      { wrapper: createQueryWrapper() },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.components).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('resolves the components filtered to the project and clears loading/error', async () => {
    getEntities.mockResolvedValueOnce({
      items: [
        componentEntity('comp-a'),
        componentEntity('comp-b'),
        {
          apiVersion: 'backstage.io/v1alpha1',
          kind: 'Component',
          metadata: {
            name: 'other-project-comp',
            annotations: {
              'openchoreo.io/namespace': 'dev',
              'openchoreo.io/project': 'other-project',
            },
          },
        },
      ],
    });

    const { result } = renderHook(
      () => useGetComponentsByProject(entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.components.map(c => c.name)).toEqual([
      'comp-a',
      'comp-b',
    ]);
    expect(result.current.error).toBeNull();
  });

  it('exposes isRefetching, false once the load settles', async () => {
    getEntities.mockResolvedValueOnce({ items: [] });

    const { result } = renderHook(
      () => useGetComponentsByProject(entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isRefetching).toBe(false);
  });
});
