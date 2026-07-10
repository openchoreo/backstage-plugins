import { renderHook, waitFor, act } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import {
  openChoreoClientApiRef,
  type NamespaceRole,
} from '../../../api/OpenChoreoClientApi';
import { useNamespaceRoles } from './useNamespaceRoles';

function makeRole(name: string): NamespaceRole {
  return { name, namespace: 'default', actions: [] };
}

function renderUseNamespaceRoles(client: any, namespace = 'default') {
  return renderHook(() => useNamespaceRoles(namespace), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useNamespaceRoles', () => {
  it('starts loading with no roles, then exposes the loaded roles', async () => {
    const client = {
      listNamespaceRoles: jest.fn().mockResolvedValue([makeRole('admin')]),
    };
    const { result } = renderUseNamespaceRoles(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.roles).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(client.listNamespaceRoles).toHaveBeenCalledWith('default');
    expect(result.current.roles).toEqual([makeRole('admin')]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('does not fetch while the namespace is undefined', () => {
    const client = { listNamespaceRoles: jest.fn() };
    const { result } = renderHook(() => useNamespaceRoles(undefined), {
      wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
    });

    expect(client.listNamespaceRoles).not.toHaveBeenCalled();
    expect(result.current.roles).toEqual([]);
  });

  it('addRole creates then invalidates → list refetches with the new role', async () => {
    const client = {
      listNamespaceRoles: jest
        .fn()
        .mockResolvedValueOnce([makeRole('admin')])
        .mockResolvedValueOnce([makeRole('admin'), makeRole('viewer')]),
      createNamespaceRole: jest.fn().mockResolvedValue(makeRole('viewer')),
    };
    const { result } = renderUseNamespaceRoles(client);
    await waitFor(() => expect(result.current.roles).toHaveLength(1));

    await act(async () => {
      await result.current.addRole(makeRole('viewer'));
    });

    expect(client.createNamespaceRole).toHaveBeenCalledWith(makeRole('viewer'));
    await waitFor(() => expect(result.current.roles).toHaveLength(2));
    expect(client.listNamespaceRoles).toHaveBeenCalledTimes(2);
  });

  it('deleteRole re-throws on failure so the caller can show an error', async () => {
    const boom = new Error('forbidden');
    const client = {
      listNamespaceRoles: jest.fn().mockResolvedValue([makeRole('admin')]),
      deleteNamespaceRole: jest.fn().mockRejectedValue(boom),
    };
    const { result } = renderUseNamespaceRoles(client);
    await waitFor(() => expect(result.current.roles).toHaveLength(1));

    await act(async () => {
      await expect(result.current.deleteRole('admin')).rejects.toBe(boom);
    });
    expect(client.deleteNamespaceRole).toHaveBeenCalledWith('default', 'admin');
  });
});
