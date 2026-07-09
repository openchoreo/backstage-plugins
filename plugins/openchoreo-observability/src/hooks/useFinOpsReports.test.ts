import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useFinOpsReports } from './useFinOpsReports';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

// Keep the real caching wrapper (useOpenChoreoQuery) — only stub the time-range
// helper so the getFinOpsReports assertion has stable start/end values.
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  calculateTimeRange: jest.fn().mockReturnValue({
    startTime: '2026-01-01T00:00:00.000Z',
    endTime: '2026-01-02T00:00:00.000Z',
  }),
}));

describe('useFinOpsReports', () => {
  const getFinOpsReports = jest.fn();

  const entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'project-a',
      annotations: { 'openchoreo.io/namespace': 'dev' },
    },
    spec: { owner: 'group:default/team' },
  };

  const baseEnvironment = {
    name: 'development',
    namespace: 'dev',
    isProduction: false,
    createdAt: '2026-01-01T00:00:00Z',
  };

  const baseFilters = {
    environment: baseEnvironment,
    timeRange: '1h',
  };

  const mockReports = [
    {
      reportId: 'report-1',
      namespace: 'dev',
      project: 'project-a',
      timestamp: '2026-01-01T00:00:00Z',
      status: 'completed' as const,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getFinOpsReports });
  });

  it('fetches reports with filters', async () => {
    getFinOpsReports.mockResolvedValueOnce({
      reports: mockReports,
      totalCount: 1,
    });

    const { result } = renderHook(
      () => useFinOpsReports(baseFilters as any, entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getFinOpsReports).toHaveBeenCalledWith(
      'dev',
      'project-a',
      'development',
      expect.objectContaining({ limit: 100 }),
    );
    expect(result.current.reports).toEqual(mockReports);
    expect(result.current.totalCount).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('returns empty reports when environment filter is missing', async () => {
    const { result } = renderHook(
      () => useFinOpsReports({ timeRange: '1h' } as any, entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getFinOpsReports).not.toHaveBeenCalled();
    expect(result.current.reports).toEqual([]);
  });

  it('returns empty reports when timeRange filter is missing', async () => {
    const { result } = renderHook(
      () =>
        useFinOpsReports(
          { environment: baseEnvironment } as any,
          entity as any,
        ),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getFinOpsReports).not.toHaveBeenCalled();
    expect(result.current.reports).toEqual([]);
  });

  it('returns empty reports when namespace annotation is missing', async () => {
    const entityNoNs = {
      ...entity,
      metadata: { name: 'project-a', annotations: {} },
    };

    const { result } = renderHook(
      () => useFinOpsReports(baseFilters as any, entityNoNs as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getFinOpsReports).not.toHaveBeenCalled();
    expect(result.current.reports).toEqual([]);
  });

  it('sets error on API failure', async () => {
    getFinOpsReports.mockRejectedValueOnce(new Error('API error'));

    const { result } = renderHook(
      () => useFinOpsReports(baseFilters as any, entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('API error');
    expect(result.current.reports).toEqual([]);
  });

  it('sets generic error message for non-Error rejections', async () => {
    getFinOpsReports.mockRejectedValueOnce('unknown');

    const { result } = renderHook(
      () => useFinOpsReports(baseFilters as any, entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch cost analysis reports');
  });

  it('refresh triggers a re-fetch', async () => {
    getFinOpsReports
      .mockResolvedValueOnce({ reports: mockReports, totalCount: 1 })
      .mockResolvedValueOnce({ reports: mockReports, totalCount: 1 });

    const { result } = renderHook(
      () => useFinOpsReports(baseFilters as any, entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getFinOpsReports).toHaveBeenCalledTimes(1);

    result.current.refresh();
    await waitFor(() => expect(getFinOpsReports).toHaveBeenCalledTimes(2));
  });
});
