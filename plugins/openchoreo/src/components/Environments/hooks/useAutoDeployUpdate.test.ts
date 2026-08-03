import { renderHook, waitFor, act } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useAutoDeployUpdate } from './useAutoDeployUpdate';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'checkout', namespace: 'default' },
};

function renderUseAutoDeployUpdate(patchComponent: jest.Mock) {
  const client = { patchComponent } as any;
  return renderHook(() => useAutoDeployUpdate(entity), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useAutoDeployUpdate', () => {
  it('is idle initially', () => {
    const { result } = renderUseAutoDeployUpdate(jest.fn());

    expect(result.current.isUpdating).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('patches the component with the requested auto-deploy value', async () => {
    const patchComponent = jest.fn().mockResolvedValue(undefined);
    const { result } = renderUseAutoDeployUpdate(patchComponent);

    await act(async () => {
      await result.current.updateAutoDeploy(true);
    });

    expect(patchComponent).toHaveBeenCalledWith(entity, true);
    expect(result.current.error).toBeNull();
  });

  it('re-throws on failure and surfaces the error message', async () => {
    const patchComponent = jest
      .fn()
      .mockRejectedValue(new Error('permission denied'));
    const { result } = renderUseAutoDeployUpdate(patchComponent);

    await act(async () => {
      await expect(result.current.updateAutoDeploy(false)).rejects.toThrow(
        'permission denied',
      );
    });

    await waitFor(() => expect(result.current.error).toBe('permission denied'));
  });
});
