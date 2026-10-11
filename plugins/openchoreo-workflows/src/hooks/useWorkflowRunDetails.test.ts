import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { genericWorkflowsClientApiRef } from '../api';
import type { WorkflowRun } from '../types';
import { useWorkflowRunDetails } from './useWorkflowRunDetails';

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

function renderUseWorkflowRunDetails(client: any) {
  return renderHook(() => useWorkflowRunDetails('run-1'), {
    wrapper: createQueryWrapper([[genericWorkflowsClientApiRef, client]]),
  });
}

describe('useWorkflowRunDetails', () => {
  it('starts loading with a null run, then resolves the run details', async () => {
    const client = {
      getWorkflowRun: jest.fn().mockResolvedValue(makeRun('run-1')),
    };
    const { result } = renderUseWorkflowRunDetails(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.run).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.run).toEqual(makeRun('run-1'));
    expect(result.current.error).toBeNull();
    expect(client.getWorkflowRun).toHaveBeenCalledWith('ns-a', 'run-1');
  });

  it('exposes isRefetching, which is false once the initial load settles', async () => {
    const client = {
      getWorkflowRun: jest.fn().mockResolvedValue(makeRun('run-1')),
    };
    const { result } = renderUseWorkflowRunDetails(client);

    expect(result.current.isRefetching).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isRefetching).toBe(false);
  });

  it('merges status and conditions from getWorkflowRunStatus into run details', async () => {
    const run = makeRun('run-failed');
    run.status = 'Pending';
    const mockConditions = [
      {
        type: 'WorkflowCompleted',
        status: 'False',
        reason: 'WorkflowRenderingFailed',
        message: 'CEL compilation error in template',
      },
    ];
    const client = {
      getWorkflowRun: jest.fn().mockResolvedValue(run),
      getWorkflowRunStatus: jest.fn().mockResolvedValue({
        status: 'Failed',
        steps: [],
        hasLiveObservability: false,
        conditions: mockConditions,
      }),
    };
    const { result } = renderUseWorkflowRunDetails(client);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.run?.status).toBe('Failed');
    expect(result.current.run?.conditions).toEqual(mockConditions);
    expect(client.getWorkflowRunStatus).toHaveBeenCalledWith('ns-a', 'run-1');
  });

  it('falls back gracefully if getWorkflowRunStatus throws', async () => {
    const run = makeRun('run-legacy');
    const client = {
      getWorkflowRun: jest.fn().mockResolvedValue(run),
      getWorkflowRunStatus: jest.fn().mockRejectedValue(new Error('Status endpoint unavailable')),
    };
    const { result } = renderUseWorkflowRunDetails(client);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.run?.status).toBe('Succeeded');
    expect(result.current.error).toBeNull();
  });
});
