import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { genericWorkflowsClientApiRef } from '../api';
import type { WorkflowRun } from '../types';
import { useWorkflowRuns } from './useWorkflowRuns';

jest.mock('../context', () => ({
  useSelectedNamespace: () => 'ns-a',
}));

function makeRun(name: string): WorkflowRun {
  return {
    name,
    workflowName: 'build',
    namespaceName: 'ns-a',
    status: 'Succeeded',
    createdAt: '2026-01-01T00:00:00Z',
  };
}

function renderUseWorkflowRuns(client: any) {
  return renderHook(() => useWorkflowRuns(), {
    wrapper: createQueryWrapper([[genericWorkflowsClientApiRef, client]]),
  });
}

describe('useWorkflowRuns', () => {
  it('starts loading with an empty list, then resolves the run items', async () => {
    const client = {
      listWorkflowRuns: jest
        .fn()
        .mockResolvedValue({ items: [makeRun('run-1')] }),
    };
    const { result } = renderUseWorkflowRuns(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.runs).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.runs).toEqual([makeRun('run-1')]);
    expect(result.current.error).toBeNull();
    expect(client.listWorkflowRuns).toHaveBeenCalledWith('ns-a', undefined);
  });

  it('exposes isRefetching, which is false once the initial load settles', async () => {
    const client = {
      listWorkflowRuns: jest.fn().mockResolvedValue({ items: [] }),
    };
    const { result } = renderUseWorkflowRuns(client);

    expect(result.current.isRefetching).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isRefetching).toBe(false);
  });
});
