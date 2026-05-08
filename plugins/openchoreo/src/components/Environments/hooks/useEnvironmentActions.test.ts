import { renderHook, act } from '@testing-library/react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import { useEnvironmentActions } from './useEnvironmentActions';
import type { ItemActionTracker } from '../types';

const mockClient = {
  deleteReleaseBinding: jest.fn(),
};

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: () => mockClient,
}));

function tracker(): ItemActionTracker {
  return {
    isActive: jest.fn().mockReturnValue(false),
    withTracking: jest.fn(async (_id: string, fn: () => Promise<any>) => fn()),
    activeItems: new Set<string>(),
    startAction: jest.fn(),
    endAction: jest.fn(),
  } as unknown as ItemActionTracker;
}

describe('useEnvironmentActions.handleRemoveDeployment', () => {
  const entity = mockComponentEntity();
  const refetch = jest.fn();
  const showSuccess = jest.fn();
  const showError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient.deleteReleaseBinding.mockResolvedValue({});
  });

  it('calls deleteReleaseBinding with the env name (not the binding name)', async () => {
    const { result } = renderHook(() =>
      useEnvironmentActions(
        entity,
        refetch,
        { showSuccess, showError },
        tracker(),
      ),
    );

    await act(async () => {
      await result.current.handleRemoveDeployment('staging-binding', 'staging');
    });

    expect(mockClient.deleteReleaseBinding).toHaveBeenCalledWith(
      entity,
      'staging',
    );
  });

  it('refetches and shows a success toast naming the env on success', async () => {
    const { result } = renderHook(() =>
      useEnvironmentActions(
        entity,
        refetch,
        { showSuccess, showError },
        tracker(),
      ),
    );

    await act(async () => {
      await result.current.handleRemoveDeployment('staging-binding', 'staging');
    });

    expect(refetch).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('staging'),
    );
    expect(showError).not.toHaveBeenCalled();
  });

  it('propagates API errors and does not show a success toast', async () => {
    mockClient.deleteReleaseBinding.mockRejectedValue(new Error('forbidden'));

    const { result } = renderHook(() =>
      useEnvironmentActions(
        entity,
        refetch,
        { showSuccess, showError },
        tracker(),
      ),
    );

    await expect(
      act(async () => {
        await result.current.handleRemoveDeployment(
          'staging-binding',
          'staging',
        );
      }),
    ).rejects.toThrow('forbidden');

    expect(showSuccess).not.toHaveBeenCalled();
    expect(refetch).not.toHaveBeenCalled();
  });
});
