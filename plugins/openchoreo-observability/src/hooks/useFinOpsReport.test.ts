import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useFinOpsReport } from './useFinOpsReport';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useFinOpsReport', () => {
  const getFinOpsReport = jest.fn();

  const entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'project-a',
      annotations: { 'openchoreo.io/namespace': 'dev' },
    },
    spec: { owner: 'group:default/team' },
  };

  const mockReport = {
    reportId: 'report-1',
    namespace: 'dev',
    project: 'project-a',
    timestamp: '2026-01-01T00:00:00Z',
    status: 'completed' as const,
    report: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getFinOpsReport });
  });

  it('fetches report when reportId and environmentName are provided', async () => {
    getFinOpsReport.mockResolvedValueOnce(mockReport);

    const { result } = renderHook(
      () => useFinOpsReport('report-1', 'development', entity as any),
      { wrapper: createQueryWrapper() },
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getFinOpsReport).toHaveBeenCalledWith(
      'report-1',
      'development',
      'dev',
    );
    expect(result.current.report).toEqual(mockReport);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when reportId is undefined', async () => {
    const { result } = renderHook(
      () => useFinOpsReport(undefined, 'development', entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getFinOpsReport).not.toHaveBeenCalled();
    expect(result.current.report).toBeNull();
  });

  it('does not fetch when environmentName is undefined', async () => {
    const { result } = renderHook(
      () => useFinOpsReport('report-1', undefined, entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getFinOpsReport).not.toHaveBeenCalled();
    expect(result.current.report).toBeNull();
  });

  it('sets error when namespace annotation is missing', async () => {
    const entityNoNamespace = {
      ...entity,
      metadata: { name: 'project-a', annotations: {} },
    };

    const { result } = renderHook(
      () =>
        useFinOpsReport('report-1', 'development', entityNoNamespace as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getFinOpsReport).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Missing required annotation: namespace');
  });

  it('sets error on API failure', async () => {
    getFinOpsReport.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(
      () => useFinOpsReport('report-1', 'development', entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.report).toBeNull();
  });

  it('sets generic error message for non-Error rejections', async () => {
    getFinOpsReport.mockRejectedValueOnce('unexpected');

    const { result } = renderHook(
      () => useFinOpsReport('report-1', 'development', entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch cost analysis report');
  });

  it('exposes a refresh function that re-fetches', async () => {
    getFinOpsReport
      .mockResolvedValueOnce(mockReport)
      .mockResolvedValueOnce({ ...mockReport, status: 'completed' as const });

    const { result } = renderHook(
      () => useFinOpsReport('report-1', 'development', entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getFinOpsReport).toHaveBeenCalledTimes(1);

    result.current.refresh();
    await waitFor(() => expect(getFinOpsReport).toHaveBeenCalledTimes(2));
  });
});
