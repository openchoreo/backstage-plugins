import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useMetrics } from './useMetrics';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useMetrics', () => {
  const getMetrics = jest.fn();

  const entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'component-a',
      annotations: {
        'openchoreo.io/namespace': 'dev',
        'openchoreo.io/component': 'component-a',
      },
    },
    spec: { owner: 'group:default/team' },
  };

  const filters = {
    environment: {
      name: 'development',
      namespace: 'dev',
      isProduction: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    timeRange: '1h',
  };

  const resourceMetrics = {
    cpu: [{ timestamp: '2026-03-05T10:00:00.000Z', value: 0.5 }],
    memory: [{ timestamp: '2026-03-05T10:00:00.000Z', value: 128 }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getMetrics });
  });

  it('starts in loading state with null data', () => {
    getMetrics.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () => useMetrics(filters as any, entity as any, 'dev', 'project-a'),
      { wrapper: createQueryWrapper() },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.metrics).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('resolves the metrics and clears loading/error once settled', async () => {
    getMetrics.mockResolvedValueOnce(resourceMetrics);

    const { result } = renderHook(
      () => useMetrics(filters as any, entity as any, 'dev', 'project-a'),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getMetrics).toHaveBeenCalledWith(
      'development',
      'component-a',
      'dev',
      'project-a',
      expect.objectContaining({ type: 'resource' }),
    );
    expect(result.current.metrics).toEqual(resourceMetrics);
    expect(result.current.error).toBeNull();
  });

  it('exposes isRefetching, false once the load settles', async () => {
    getMetrics.mockResolvedValueOnce(resourceMetrics);

    const { result } = renderHook(
      () => useMetrics(filters as any, entity as any, 'dev', 'project-a'),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isRefetching).toBe(false);
  });
});
