import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { genericWorkflowsClientApiRef } from '../api';
import type { Workflow } from '../types';
import { useWorkflows } from './useWorkflows';

jest.mock('../context', () => ({
  useSelectedNamespace: () => 'ns-a',
}));

function makeWorkflow(name: string): Workflow {
  return { name, createdAt: '2026-01-01T00:00:00Z' };
}

function renderUseWorkflows(client: any) {
  return renderHook(() => useWorkflows(), {
    wrapper: createQueryWrapper([[genericWorkflowsClientApiRef, client]]),
  });
}

describe('useWorkflows', () => {
  it('starts loading with an empty list, then resolves the workflow items', async () => {
    const client = {
      listWorkflows: jest
        .fn()
        .mockResolvedValue({ items: [makeWorkflow('build')] }),
    };
    const { result } = renderUseWorkflows(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.workflows).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workflows).toEqual([makeWorkflow('build')]);
    expect(result.current.error).toBeNull();
    expect(client.listWorkflows).toHaveBeenCalledWith('ns-a');
  });

  it('exposes isRefetching, which is false once the initial load settles', async () => {
    const client = {
      listWorkflows: jest.fn().mockResolvedValue({ items: [] }),
    };
    const { result } = renderUseWorkflows(client);

    expect(result.current.isRefetching).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isRefetching).toBe(false);
  });
});
