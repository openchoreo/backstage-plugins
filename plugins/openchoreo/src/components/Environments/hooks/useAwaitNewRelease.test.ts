import { renderHook, act } from '@testing-library/react';
import { useAwaitNewRelease } from './useAwaitNewRelease';

describe('useAwaitNewRelease', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('is not awaiting until begin is called', () => {
    const { result } = renderHook(() =>
      useAwaitNewRelease({
        latestReleaseName: 'rel-1',
        refetchAutoDeploy: jest.fn(),
        refetchEnvironments: jest.fn(),
      }),
    );
    expect(result.current.awaitingNewRelease).toBe(false);
  });

  it('starts awaiting on begin and polls both refetchers', () => {
    const refetchAutoDeploy = jest.fn();
    const refetchEnvironments = jest.fn();
    const { result } = renderHook(() =>
      useAwaitNewRelease({
        latestReleaseName: 'rel-1',
        refetchAutoDeploy,
        refetchEnvironments,
      }),
    );

    act(() => result.current.beginAwaitingNewRelease());
    expect(result.current.awaitingNewRelease).toBe(true);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(refetchAutoDeploy).toHaveBeenCalled();
    expect(refetchEnvironments).toHaveBeenCalled();
  });

  it('stops awaiting once the controller advances latestReleaseName (happy path)', () => {
    const { result, rerender } = renderHook(
      (props: { latestReleaseName: string | null; hasError?: boolean }) =>
        useAwaitNewRelease({
          ...props,
          refetchAutoDeploy: jest.fn(),
          refetchEnvironments: jest.fn(),
        }),
      { initialProps: { latestReleaseName: 'rel-1' } },
    );

    act(() => result.current.beginAwaitingNewRelease());
    expect(result.current.awaitingNewRelease).toBe(true);

    // Controller produces a newer release.
    rerender({ latestReleaseName: 'rel-2' });
    expect(result.current.awaitingNewRelease).toBe(false);
  });

  it('stops awaiting when the controller reports an error (failure path)', () => {
    const { result, rerender } = renderHook(
      (props: { latestReleaseName: string | null; hasError?: boolean }) =>
        useAwaitNewRelease({
          ...props,
          refetchAutoDeploy: jest.fn(),
          refetchEnvironments: jest.fn(),
        }),
      { initialProps: { latestReleaseName: 'rel-1', hasError: false } },
    );

    act(() => result.current.beginAwaitingNewRelease());
    expect(result.current.awaitingNewRelease).toBe(true);

    // latestReleaseName never advances (controller failed before producing a
    // release), but the Ready condition flips to an error.
    rerender({ latestReleaseName: 'rel-1', hasError: true });
    expect(result.current.awaitingNewRelease).toBe(false);
  });

  it('stops awaiting after the 30s timeout when nothing changes', () => {
    const { result } = renderHook(() =>
      useAwaitNewRelease({
        latestReleaseName: 'rel-1',
        refetchAutoDeploy: jest.fn(),
        refetchEnvironments: jest.fn(),
      }),
    );

    act(() => result.current.beginAwaitingNewRelease());
    expect(result.current.awaitingNewRelease).toBe(true);

    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(result.current.awaitingNewRelease).toBe(false);
  });
});
