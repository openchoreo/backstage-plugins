import { renderHook, act } from '@testing-library/react';
import { mockComponentEntity } from '@openchoreo/test-utils';
import { useEnvironmentActions } from './useEnvironmentActions';
import type { ItemActionTracker } from '../types';

const mockClient = {
  deleteReleaseBinding: jest.fn(),
  fetchEnvironmentInfo: jest.fn(),
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

// Run all pending timers and microtasks repeatedly until the queue is
// drained. handleRemoveDeployment alternates `setTimeout` (poll wait)
// and `await fetchEnvironmentInfo` (microtask) — a single
// runAllTimers() call resolves only the first; we need to flush the
// promise chain in between.
async function flushPolling() {
  for (let i = 0; i < 20; i++) {
    jest.runOnlyPendingTimers();
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
}

describe('useEnvironmentActions.handleRemoveDeployment', () => {
  const entity = mockComponentEntity();
  const refetch = jest.fn();
  const showSuccess = jest.fn();
  const showError = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockClient.deleteReleaseBinding.mockResolvedValue({});
    // Default: env's binding is gone on the first poll (happy path).
    mockClient.fetchEnvironmentInfo.mockResolvedValue([
      { name: 'staging', resourceName: 'staging' },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
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

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.handleRemoveDeployment(
        'staging-binding',
        'staging',
      );
    });
    await act(async () => {
      await flushPolling();
      await pending;
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

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.handleRemoveDeployment(
        'staging-binding',
        'staging',
      );
    });
    await act(async () => {
      await flushPolling();
      await pending;
    });

    expect(refetch).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('staging'),
    );
    expect(showError).not.toHaveBeenCalled();
  });

  it('shows a softer success message when polling times out', async () => {
    // Binding is still there on every poll — simulate a stuck controller.
    mockClient.fetchEnvironmentInfo.mockResolvedValue([
      {
        name: 'staging',
        resourceName: 'staging',
        bindingName: 'staging-binding',
      },
    ]);

    const { result } = renderHook(() =>
      useEnvironmentActions(
        entity,
        refetch,
        { showSuccess, showError },
        tracker(),
      ),
    );

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.handleRemoveDeployment(
        'staging-binding',
        'staging',
      );
    });
    await act(async () => {
      await flushPolling();
      await pending;
    });

    expect(refetch).toHaveBeenCalled();
    expect(showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('UI may take a moment'),
    );
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
