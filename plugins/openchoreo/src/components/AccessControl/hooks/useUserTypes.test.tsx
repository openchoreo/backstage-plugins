import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import {
  openChoreoClientApiRef,
  type UserTypeConfig,
} from '../../../api/OpenChoreoClientApi';
import { useUserTypes } from './useUserTypes';

function makeUserType(displayName: string): UserTypeConfig {
  return {
    type: 'user',
    displayName,
    priority: 1,
    authMechanisms: [
      { type: 'jwt', entitlement: { claim: 'sub', displayName: 'Subject' } },
    ],
  };
}

function renderUseUserTypes(client: any) {
  return renderHook(() => useUserTypes(), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useUserTypes', () => {
  it('starts in a loading state with no user types', () => {
    const client = {
      listUserTypes: jest.fn().mockResolvedValue([makeUserType('Human')]),
    };
    const { result } = renderUseUserTypes(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.userTypes).toEqual([]);
  });

  it('loads user types and exposes them once resolved', async () => {
    const client = {
      listUserTypes: jest
        .fn()
        .mockResolvedValue([makeUserType('Human'), makeUserType('Robot')]),
    };
    const { result } = renderUseUserTypes(client);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.userTypes).toEqual([
      makeUserType('Human'),
      makeUserType('Robot'),
    ]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });
});
