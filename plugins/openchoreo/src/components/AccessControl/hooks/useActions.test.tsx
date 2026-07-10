import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import {
  openChoreoClientApiRef,
  type ActionInfo,
} from '../../../api/OpenChoreoClientApi';
import { useActions } from './useActions';

function makeAction(name: string): ActionInfo {
  return { name, lowestScope: 'cluster' };
}

function renderUseActions(client: any) {
  return renderHook(() => useActions(), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useActions', () => {
  it('starts in a loading state with no actions', () => {
    const client = {
      listActions: jest.fn().mockResolvedValue([makeAction('read')]),
    };
    const { result } = renderUseActions(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.actions).toEqual([]);
  });

  it('loads actions and exposes them once resolved', async () => {
    const client = {
      listActions: jest
        .fn()
        .mockResolvedValue([makeAction('read'), makeAction('write')]),
    };
    const { result } = renderUseActions(client);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.actions).toEqual([
      makeAction('read'),
      makeAction('write'),
    ]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });
});
