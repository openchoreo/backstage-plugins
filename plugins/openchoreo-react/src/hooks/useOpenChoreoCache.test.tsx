import { renderHook, waitFor, act } from '@testing-library/react';
import { createQueryClientWrapper } from '@openchoreo/test-utils';
import { useOpenChoreoCache } from './useOpenChoreoCache';

describe('useOpenChoreoCache', () => {
  it('returns a stable handle across renders', () => {
    const { result, rerender } = renderHook(() => useOpenChoreoCache(), {
      wrapper: createQueryClientWrapper(),
    });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('fetchQuery populates the cache and getData reads it back', async () => {
    const fetcher = jest.fn().mockResolvedValue({ id: 'c1' });
    const { result } = renderHook(() => useOpenChoreoCache(), {
      wrapper: createQueryClientWrapper(),
    });

    // Nothing cached yet.
    expect(result.current.getData(['comp', 'c1'])).toBeUndefined();

    let fetched: unknown;
    await act(async () => {
      fetched = await result.current.fetchQuery(['comp', 'c1'], fetcher);
    });

    expect(fetched).toEqual({ id: 'c1' });
    expect(result.current.getData(['comp', 'c1'])).toEqual({ id: 'c1' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fetchQuery serves the cached value within staleTime (dedupes the fetcher)', async () => {
    const fetcher = jest.fn().mockResolvedValue('v');
    const { result } = renderHook(() => useOpenChoreoCache(), {
      wrapper: createQueryClientWrapper(),
    });

    await act(async () => {
      await result.current.fetchQuery(['k'], fetcher, { staleTime: 60_000 });
    });
    let second: unknown;
    await act(async () => {
      second = await result.current.fetchQuery(['k'], fetcher, {
        staleTime: 60_000,
      });
    });

    expect(second).toBe('v');
    // Within staleTime the fetcher is not called again.
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('fetchQuery propagates a rejected fetcher and leaves nothing cached', async () => {
    const boom = new Error('boom');
    const fetcher = jest.fn().mockRejectedValue(boom);
    const { result } = renderHook(() => useOpenChoreoCache(), {
      wrapper: createQueryClientWrapper(),
    });

    await expect(
      act(async () => {
        await result.current.fetchQuery(['bad'], fetcher);
      }),
    ).rejects.toThrow('boom');

    expect(result.current.getData(['bad'])).toBeUndefined();
  });

  it('setData optimistically writes into the cache', async () => {
    const { result } = renderHook(() => useOpenChoreoCache(), {
      wrapper: createQueryClientWrapper(),
    });

    act(() => {
      result.current.setData<{ n: number }>(['count'], () => ({ n: 1 }));
    });
    expect(result.current.getData(['count'])).toEqual({ n: 1 });

    // The updater receives the previous value.
    act(() => {
      result.current.setData<{ n: number }>(['count'], prev => ({
        n: (prev?.n ?? 0) + 1,
      }));
    });
    expect(result.current.getData(['count'])).toEqual({ n: 2 });
  });

  it('remove drops the cached entry so the next read misses', () => {
    const { result } = renderHook(() => useOpenChoreoCache(), {
      wrapper: createQueryClientWrapper(),
    });

    act(() => {
      result.current.setData(['drop'], () => 'here');
    });
    expect(result.current.getData(['drop'])).toBe('here');

    act(() => {
      result.current.remove(['drop']);
    });
    expect(result.current.getData(['drop'])).toBeUndefined();
  });

  it('invalidate marks a cached prefix stale and refetches it', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce('first')
      .mockResolvedValueOnce('second');
    const { result } = renderHook(() => useOpenChoreoCache(), {
      wrapper: createQueryClientWrapper(),
    });

    await act(async () => {
      await result.current.fetchQuery(['scope', 'a'], fetcher, {
        staleTime: 60_000,
      });
    });
    await waitFor(() =>
      expect(result.current.getData(['scope', 'a'])).toBe('first'),
    );

    act(() => {
      // Prefix match: ['scope'] covers ['scope', 'a'].
      result.current.invalidate(['scope']);
    });

    // Invalidation refetches active/observed queries; fetchQuery re-runs the
    // fetcher and the cache converges on the new value.
    await act(async () => {
      await result.current.fetchQuery(['scope', 'a'], fetcher, {
        staleTime: 60_000,
      });
    });
    await waitFor(() =>
      expect(result.current.getData(['scope', 'a'])).toBe('second'),
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
