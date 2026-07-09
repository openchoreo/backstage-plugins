import { renderHook, waitFor, act } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import {
  openChoreoClientApiRef,
  type ClusterRole,
} from '../../../api/OpenChoreoClientApi';
import { useClusterRoles } from './useClusterRoles';

function makeRole(name: string): ClusterRole {
  return { name, actions: [] };
}

function renderUseClusterRoles(client: any) {
  return renderHook(() => useClusterRoles(), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useClusterRoles', () => {
  it('loads roles and exposes them', async () => {
    const client = {
      listClusterRoles: jest.fn().mockResolvedValue([makeRole('admin')]),
    };
    const { result } = renderUseClusterRoles(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.roles).toEqual([]);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.roles).toEqual([makeRole('admin')]);
    expect(result.current.error).toBeNull();
  });

  it('addRole creates then invalidates → list refetches with the new role', async () => {
    const client = {
      listClusterRoles: jest
        .fn()
        .mockResolvedValueOnce([makeRole('admin')])
        .mockResolvedValueOnce([makeRole('admin'), makeRole('viewer')]),
      createClusterRole: jest.fn().mockResolvedValue(undefined),
    };
    const { result } = renderUseClusterRoles(client);
    await waitFor(() => expect(result.current.roles).toHaveLength(1));

    await act(async () => {
      await result.current.addRole(makeRole('viewer'));
    });

    expect(client.createClusterRole).toHaveBeenCalledWith(makeRole('viewer'));
    await waitFor(() => expect(result.current.roles).toHaveLength(2));
    expect(client.listClusterRoles).toHaveBeenCalledTimes(2);
  });

  it('deleteRole re-throws on failure so the caller can show an error', async () => {
    const boom = new Error('forbidden');
    const client = {
      listClusterRoles: jest.fn().mockResolvedValue([makeRole('admin')]),
      deleteClusterRole: jest.fn().mockRejectedValue(boom),
    };
    const { result } = renderUseClusterRoles(client);
    await waitFor(() => expect(result.current.roles).toHaveLength(1));

    await act(async () => {
      await expect(result.current.deleteRole('admin')).rejects.toBe(boom);
    });
  });
});
