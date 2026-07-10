import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useRCAReport } from './useRCAReport';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useRCAReport', () => {
  const getRCAReport = jest.fn();

  const entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'project-a',
      annotations: { 'openchoreo.io/namespace': 'dev' },
    },
    spec: { owner: 'group:default/team' },
  };

  const report = {
    reportId: 'rca-1',
    status: 'completed',
    summary: 'root cause found',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getRCAReport });
  });

  it('starts in loading state with null report', () => {
    getRCAReport.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(
      () => useRCAReport('rca-1', 'development', entity as any),
      { wrapper: createQueryWrapper() },
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.report).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('resolves the report and clears loading/error once settled', async () => {
    getRCAReport.mockResolvedValueOnce(report);

    const { result } = renderHook(
      () => useRCAReport('rca-1', 'development', entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getRCAReport).toHaveBeenCalledWith('rca-1', 'development', 'dev');
    expect(result.current.report).toEqual(report);
    expect(result.current.error).toBeNull();
  });

  it('exposes isRefetching, false once the load settles', async () => {
    getRCAReport.mockResolvedValueOnce(report);

    const { result } = renderHook(
      () => useRCAReport('rca-1', 'development', entity as any),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isRefetching).toBe(false);
  });
});
