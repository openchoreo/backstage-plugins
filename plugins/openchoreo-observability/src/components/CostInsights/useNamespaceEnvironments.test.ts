import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useNamespaceEnvironments } from './useNamespaceEnvironments';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return { ...actual, useApi: jest.fn() };
});

describe('useNamespaceEnvironments', () => {
  const getEntities = jest.fn();

  const envEntity = (name: string, title?: string) => ({
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Environment',
    metadata: {
      name,
      ...(title ? { title } : {}),
      annotations: { 'openchoreo.io/namespace': 'default' },
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getEntities });
  });

  it('lists the namespace environments sorted by name', async () => {
    getEntities.mockResolvedValueOnce({
      items: [envEntity('prod', 'Production'), envEntity('dev', 'Development')],
    });

    const { result } = renderHook(() => useNamespaceEnvironments('default'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { kind: 'Environment', 'metadata.namespace': 'default' },
      }),
    );
    expect(result.current.environments.map(e => e.name)).toEqual([
      'dev',
      'prod',
    ]);
    // Display name falls back to the catalog title.
    expect(result.current.environments[0].displayName).toBe('Development');
    expect(result.current.error).toBeNull();
  });

  it('falls back to the entity name when no title is set', async () => {
    getEntities.mockResolvedValueOnce({ items: [envEntity('dev')] });

    const { result } = renderHook(() => useNamespaceEnvironments('default'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments[0].displayName).toBe('dev');
  });

  it('unions and dedupes environments across multiple namespaces', async () => {
    getEntities
      .mockResolvedValueOnce({ items: [envEntity('dev'), envEntity('prod')] })
      .mockResolvedValueOnce({ items: [envEntity('dev'), envEntity('stage')] });

    const { result } = renderHook(
      () => useNamespaceEnvironments(['default', 'other']),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getEntities).toHaveBeenCalledTimes(2);
    // `dev` appears in both namespaces but collapses to a single option.
    expect(result.current.environments.map(e => e.name)).toEqual([
      'dev',
      'prod',
      'stage',
    ]);
  });

  it('does not query the catalog without a namespace', async () => {
    const { result } = renderHook(() => useNamespaceEnvironments(undefined), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getEntities).not.toHaveBeenCalled();
    expect(result.current.environments).toEqual([]);
  });

  it('surfaces the error message on failure', async () => {
    getEntities.mockRejectedValueOnce(new Error('catalog down'));

    const { result } = renderHook(() => useNamespaceEnvironments('default'), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBe('catalog down'));
    expect(result.current.environments).toEqual([]);
  });
});
