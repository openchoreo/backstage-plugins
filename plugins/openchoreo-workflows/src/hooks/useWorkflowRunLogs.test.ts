import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { genericWorkflowsClientApiRef } from '../api';
import type { LogsResponse } from '../types';
import { useWorkflowRunLogs } from './useWorkflowRunLogs';

jest.mock('../context', () => ({
  useSelectedNamespace: () => 'ns-a',
}));

function makeLogs(): LogsResponse {
  return {
    logs: [{ timestamp: '2026-01-01T00:00:00Z', log: 'building...' }],
    totalCount: 1,
  };
}

function renderUseWorkflowRunLogs(client: any) {
  return renderHook(() => useWorkflowRunLogs('run-1'), {
    wrapper: createQueryWrapper([[genericWorkflowsClientApiRef, client]]),
  });
}

describe('useWorkflowRunLogs', () => {
  it('starts loading with null logs, then resolves the logs response', async () => {
    const client = {
      getWorkflowRunLogs: jest.fn().mockResolvedValue(makeLogs()),
    };
    const { result } = renderUseWorkflowRunLogs(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.logs).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.logs).toEqual(makeLogs());
    expect(result.current.error).toBeNull();
    expect(client.getWorkflowRunLogs).toHaveBeenCalledWith('ns-a', 'run-1');
  });

  it('exposes isRefetching, which is false once the initial load settles', async () => {
    const client = {
      getWorkflowRunLogs: jest.fn().mockResolvedValue(makeLogs()),
    };
    const { result } = renderUseWorkflowRunLogs(client);

    expect(result.current.isRefetching).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isRefetching).toBe(false);
  });
});
