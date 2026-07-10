import { renderHook, waitFor, act } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import {
  openChoreoClientApiRef,
  type NamespaceRoleBinding,
  type NamespaceRoleBindingRequest,
} from '../../../api/OpenChoreoClientApi';
import { useNamespaceRoleBindings } from './useNamespaceRoleBindings';

function makeBinding(name: string): NamespaceRoleBinding {
  return {
    name,
    namespace: 'default',
    roleMappings: [],
    entitlement: { claim: 'group', value: 'admins' },
    effect: 'allow',
  };
}

function makeRequest(name: string): NamespaceRoleBindingRequest {
  return {
    name,
    roleMappings: [],
    entitlement: { claim: 'group', value: 'admins' },
    effect: 'allow',
  };
}

function renderUseNamespaceRoleBindings(client: any, namespace = 'default') {
  return renderHook(() => useNamespaceRoleBindings(namespace), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useNamespaceRoleBindings', () => {
  it('starts loading with no bindings, then exposes the loaded bindings', async () => {
    const client = {
      listNamespaceRoleBindings: jest
        .fn()
        .mockResolvedValue([makeBinding('bind-a')]),
    };
    const { result } = renderUseNamespaceRoleBindings(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.bindings).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(client.listNamespaceRoleBindings).toHaveBeenCalledWith(
      'default',
      {},
    );
    expect(result.current.bindings).toEqual([makeBinding('bind-a')]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('does not fetch while the namespace is undefined', () => {
    const client = { listNamespaceRoleBindings: jest.fn() };
    const { result } = renderHook(() => useNamespaceRoleBindings(undefined), {
      wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
    });

    expect(client.listNamespaceRoleBindings).not.toHaveBeenCalled();
    expect(result.current.bindings).toEqual([]);
  });

  it('addBinding creates then invalidates → list refetches with the new binding', async () => {
    const client = {
      listNamespaceRoleBindings: jest
        .fn()
        .mockResolvedValueOnce([makeBinding('bind-a')])
        .mockResolvedValueOnce([makeBinding('bind-a'), makeBinding('bind-b')]),
      createNamespaceRoleBinding: jest.fn().mockResolvedValue(undefined),
    };
    const { result } = renderUseNamespaceRoleBindings(client);
    await waitFor(() => expect(result.current.bindings).toHaveLength(1));

    await act(async () => {
      await result.current.addBinding(makeRequest('bind-b'));
    });

    expect(client.createNamespaceRoleBinding).toHaveBeenCalledWith(
      'default',
      makeRequest('bind-b'),
    );
    await waitFor(() => expect(result.current.bindings).toHaveLength(2));
    expect(client.listNamespaceRoleBindings).toHaveBeenCalledTimes(2);
  });

  it('deleteBinding re-throws on failure so the caller can show an error', async () => {
    const boom = new Error('forbidden');
    const client = {
      listNamespaceRoleBindings: jest
        .fn()
        .mockResolvedValue([makeBinding('bind-a')]),
      deleteNamespaceRoleBinding: jest.fn().mockRejectedValue(boom),
    };
    const { result } = renderUseNamespaceRoleBindings(client);
    await waitFor(() => expect(result.current.bindings).toHaveLength(1));

    await act(async () => {
      await expect(result.current.deleteBinding('bind-a')).rejects.toBe(boom);
    });
    expect(client.deleteNamespaceRoleBinding).toHaveBeenCalledWith(
      'default',
      'bind-a',
    );
  });
});
