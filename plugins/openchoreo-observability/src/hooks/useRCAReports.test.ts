import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useRCAReports } from './useRCAReports';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useRCAReports', () => {
  const getRCAReports = jest.fn();

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
    environment: {
      name: 'development',
      namespace: 'dev',
      isProduction: false,
      createdAt: '2026-01-01T00:00:00Z',
    },
    timeRange: '1h',
  };

  const makeReport = (id: string) => ({
    reportId: id,
    status: 'completed',
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getRCAReports });
  });

  it('starts in loading state with empty reports', () => {
    getRCAReports.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () => useRCAReports(filters as any, entity as any),
      { wrapper: createQueryWrapper() },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.reports).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('resolves reports and total count, clears loading/error once settled', async () => {
    getRCAReports.mockResolvedValueOnce({
      reports: [makeReport('rca-1'), makeReport('rca-2')],
      totalCount: 2,
    });

    const { result } = renderHook(
      () => useRCAReports(filters as any, entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getRCAReports).toHaveBeenCalledWith(
      'dev',
      'project-a',
      'development',
      expect.any(Object),
    );
    expect(result.current.reports).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('exposes isRefetching, false once the load settles', async () => {
    getRCAReports.mockResolvedValueOnce({ reports: [], totalCount: 0 });

    const { result } = renderHook(
      () => useRCAReports(filters as any, entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isRefetching).toBe(false);
  });
});
