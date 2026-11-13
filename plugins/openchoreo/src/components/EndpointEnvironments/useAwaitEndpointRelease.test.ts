import { act, renderHook } from '@testing-library/react';
import {
  backendsReflect,
  useAwaitEndpointRelease,
} from './useAwaitEndpointRelease';

describe('backendsReflect', () => {
  const backends = [{ name: 'primary', weight: 2 }, { name: 'canary' }];

  it('checks an added backend is there', () => {
    expect(
      backendsReflect({ kind: 'add', backendName: 'canary' }, backends),
    ).toBe(true);
    expect(backendsReflect({ kind: 'add', backendName: 'new' }, backends)).toBe(
      false,
    );
  });

  it('checks a weight, reading a missing one as 1', () => {
    const weight = (backendName: string, w: number) =>
      backendsReflect({ kind: 'weight', backendName, weight: w }, backends);
    expect(weight('primary', 2)).toBe(true);
    expect(weight('primary', 3)).toBe(false);
    expect(weight('canary', 1)).toBe(true);
  });

  it('checks a removed backend is gone', () => {
    expect(
      backendsReflect({ kind: 'remove', backendName: 'canary' }, backends),
    ).toBe(false);
    expect(
      backendsReflect({ kind: 'remove', backendName: 'gone' }, backends),
    ).toBe(true);
  });
});

describe('useAwaitEndpointRelease', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup() {
    const refetchEnvironments = jest.fn();
    const refreshEntity = jest.fn();
    const hook = renderHook(
      ({ latestRelease, backends }) =>
        useAwaitEndpointRelease({
          latestRelease,
          backends,
          refetchEnvironments,
          refreshEntity,
        }),
      {
        initialProps: {
          latestRelease: 'rel-1' as string | undefined,
          backends: [{ name: 'primary' }] as { name: string }[],
        },
      },
    );
    return { ...hook, refetchEnvironments, refreshEntity };
  }

  it('polls until a new release is cut and the entity shows the change', () => {
    const { result, rerender, refetchEnvironments, refreshEntity } = setup();

    act(() =>
      result.current.beginAwaitingNewRelease({
        kind: 'add',
        backendName: 'canary',
      }),
    );
    expect(result.current.awaitingNewRelease).toBe(true);
    expect(refetchEnvironments).toHaveBeenCalledTimes(1);
    expect(refreshEntity).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(refetchEnvironments).toHaveBeenCalledTimes(3);

    rerender({ latestRelease: 'rel-2', backends: [{ name: 'primary' }] });
    expect(result.current.awaitingNewRelease).toBe(true);

    rerender({
      latestRelease: 'rel-2',
      backends: [{ name: 'primary' }, { name: 'canary' }],
    });
    expect(result.current.awaitingNewRelease).toBe(false);

    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(refetchEnvironments).toHaveBeenCalledTimes(3);
  });

  it('stops polling after 30 seconds, keeping the change unconfirmed', () => {
    const { result, rerender, refetchEnvironments } = setup();

    act(() =>
      result.current.beginAwaitingNewRelease({
        kind: 'remove',
        backendName: 'primary',
      }),
    );
    expect(result.current.unconfirmed).toBe(false);
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    expect(result.current.awaitingNewRelease).toBe(true);
    expect(result.current.unconfirmed).toBe(true);
    const calls = refetchEnvironments.mock.calls.length;
    act(() => {
      jest.advanceTimersByTime(10000);
    });
    expect(refetchEnvironments).toHaveBeenCalledTimes(calls);

    // A retry polls again.
    act(() => result.current.retryAwait());
    expect(result.current.unconfirmed).toBe(false);
    expect(refetchEnvironments).toHaveBeenCalledTimes(calls + 1);

    // The change showing up, late, still confirms it.
    rerender({ latestRelease: 'rel-2', backends: [] });
    expect(result.current.awaitingNewRelease).toBe(false);
    expect(result.current.unconfirmed).toBe(false);
  });
});
