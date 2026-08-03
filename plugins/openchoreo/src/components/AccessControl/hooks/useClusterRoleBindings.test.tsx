import { renderHook, waitFor, act } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import {
  openChoreoClientApiRef,
  type ClusterRoleBinding,
  type ClusterRoleBindingRequest,
} from '../../../api/OpenChoreoClientApi';
import { useClusterRoleBindings } from './useClusterRoleBindings';

function makeBinding(name: string): ClusterRoleBinding {
  return {
    name,
    roleMappings: [],
    entitlement: { claim: 'group', value: 'admins' },
    effect: 'allow',
  };
}

function makeRequest(name: string): ClusterRoleBindingRequest {
  return {
    name,
    roleMappings: [],
    entitlement: { claim: 'group', value: 'admins' },
    effect: 'allow',
  };
}

function renderUseClusterRoleBindings(client: any) {
  return renderHook(() => useClusterRoleBindings(), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useClusterRoleBindings', () => {
  it('starts loading with no bindings, then exposes the loaded bindings', async () => {
    const client = {
      listClusterRoleBindings: jest
        .fn()
        .mockResolvedValue([makeBinding('bind-a')]),
    };
    const { result } = renderUseClusterRoleBindings(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.bindings).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.bindings).toEqual([makeBinding('bind-a')]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('addBinding creates then invalidates → list refetches with the new binding', async () => {
    const client = {
      listClusterRoleBindings: jest
        .fn()
        .mockResolvedValueOnce([makeBinding('bind-a')])
        .mockResolvedValueOnce([makeBinding('bind-a'), makeBinding('bind-b')]),
      createClusterRoleBinding: jest.fn().mockResolvedValue(undefined),
    };
    const { result } = renderUseClusterRoleBindings(client);
    await waitFor(() => expect(result.current.bindings).toHaveLength(1));

    await act(async () => {
      await result.current.addBinding(makeRequest('bind-b'));
    });

    expect(client.createClusterRoleBinding).toHaveBeenCalledWith(
      makeRequest('bind-b'),
    );
    await waitFor(() => expect(result.current.bindings).toHaveLength(2));
    expect(client.listClusterRoleBindings).toHaveBeenCalledTimes(2);
  });

  it('deleteBinding re-throws on failure so the caller can show an error', async () => {
    const boom = new Error('forbidden');
    const client = {
      listClusterRoleBindings: jest
        .fn()
        .mockResolvedValue([makeBinding('bind-a')]),
      deleteClusterRoleBinding: jest.fn().mockRejectedValue(boom),
    };
    const { result } = renderUseClusterRoleBindings(client);
    await waitFor(() => expect(result.current.bindings).toHaveLength(1));

    await act(async () => {
      await expect(result.current.deleteBinding('bind-a')).rejects.toBe(boom);
    });
    expect(client.deleteClusterRoleBinding).toHaveBeenCalledWith('bind-a');
  });
});
