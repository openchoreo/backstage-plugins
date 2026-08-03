import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useComponentAlerts } from './useComponentAlerts';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useComponentAlerts', () => {
  const getAlerts = jest.fn();

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

  const options = {
    environment: 'development',
    timeRange: '1h',
  };

  const makeAlert = (id: string) => ({
    alertId: id,
    severity: 'critical',
    status: 'firing',
    triggeredAt: '2026-03-05T10:00:00.000Z',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getAlerts });
  });

  it('starts in loading state with empty data', () => {
    getAlerts.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () => useComponentAlerts(entity as any, 'dev', 'project-a', options),
      { wrapper: createQueryWrapper() },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.alerts).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('exposes resolved alerts, total count and clears loading/error once settled', async () => {
    getAlerts.mockResolvedValueOnce({
      alerts: [makeAlert('alert-1'), makeAlert('alert-2')],
      total: 2,
    });

    const { result } = renderHook(
      () => useComponentAlerts(entity as any, 'dev', 'project-a', options),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getAlerts).toHaveBeenCalledWith(
      'dev',
      'project-a',
      'development',
      'component-a',
      expect.any(Object),
    );
    expect(result.current.alerts).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('exposes isRefetching, false once the load settles', async () => {
    getAlerts.mockResolvedValueOnce({ alerts: [], total: 0 });

    const { result } = renderHook(
      () => useComponentAlerts(entity as any, 'dev', 'project-a', options),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isRefetching).toBe(false);
  });
});
