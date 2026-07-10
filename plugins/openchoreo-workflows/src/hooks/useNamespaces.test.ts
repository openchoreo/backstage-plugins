import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { genericWorkflowsClientApiRef } from '../api';
import { useNamespaces } from './useNamespaces';

function renderUseNamespaces(client: any) {
  return renderHook(() => useNamespaces(), {
    wrapper: createQueryWrapper([[genericWorkflowsClientApiRef, client]]),
  });
}

describe('useNamespaces', () => {
  it('starts loading with an empty list, then resolves the namespaces', async () => {
    const client = {
      listNamespaces: jest.fn().mockResolvedValue(['ns-a', 'ns-b']),
    };
    const { result } = renderUseNamespaces(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.namespaces).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.namespaces).toEqual(['ns-a', 'ns-b']);
    expect(result.current.error).toBeNull();
  });

  it('exposes isRefetching, which is false once the initial load settles', async () => {
    const client = {
      listNamespaces: jest.fn().mockResolvedValue(['ns-a']),
    };
    const { result } = renderUseNamespaces(client);

    expect(result.current.isRefetching).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isRefetching).toBe(false);
  });
});
