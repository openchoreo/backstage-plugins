import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useProjectIncidents } from './useProjectIncidents';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useProjectIncidents', () => {
  const getIncidents = jest.fn();

  const entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'project-a',
      annotations: { 'openchoreo.io/namespace': 'dev' },
    },
    spec: { owner: 'group:default/team' },
  };

  const filters = {
    environment: 'development',
    timeRange: '1h',
  };

  const makeIncident = (id: string, triggeredAt: string) => ({
    incidentId: id,
    status: 'firing',
    triggeredAt,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getIncidents });
  });

  it('starts in loading state with empty data', () => {
    getIncidents.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () => useProjectIncidents(entity as any, filters),
      { wrapper: createQueryWrapper() },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.incidents).toEqual([]);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('resolves incidents and total count, clears loading/error once settled', async () => {
    getIncidents.mockResolvedValueOnce({
      incidents: [
        makeIncident('inc-1', '2026-03-05T10:00:00.000Z'),
        makeIncident('inc-2', '2026-03-05T10:01:00.000Z'),
      ],
      total: 2,
    });

    const { result } = renderHook(
      () => useProjectIncidents(entity as any, filters),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getIncidents).toHaveBeenCalledWith(
      'dev',
      'project-a',
      'development',
      undefined,
      expect.any(Object),
    );
    expect(result.current.incidents).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('exposes isRefetching, false once the load settles', async () => {
    getIncidents.mockResolvedValueOnce({ incidents: [], total: 0 });

    const { result } = renderHook(
      () => useProjectIncidents(entity as any, filters),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isRefetching).toBe(false);
  });
});
