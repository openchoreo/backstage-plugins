import { renderHook } from '@testing-library/react';
import { useAutoLoadWhenEmpty } from './useAutoLoadWhenEmpty';

describe('useAutoLoadWhenEmpty', () => {
  it('fires onLoadMore when the list is empty with more to load', () => {
    const onLoadMore = jest.fn();
    renderHook(() =>
      useAutoLoadWhenEmpty({
        count: 0,
        hasMore: true,
        loading: false,
        onLoadMore,
      }),
    );
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not fire while a request is in flight', () => {
    const onLoadMore = jest.fn();
    renderHook(() =>
      useAutoLoadWhenEmpty({
        count: 0,
        hasMore: true,
        loading: true,
        onLoadMore,
      }),
    );
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not fire when there is nothing more to load', () => {
    const onLoadMore = jest.fn();
    renderHook(() =>
      useAutoLoadWhenEmpty({
        count: 0,
        hasMore: false,
        loading: false,
        onLoadMore,
      }),
    );
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not fire when the list already has items', () => {
    const onLoadMore = jest.fn();
    renderHook(() =>
      useAutoLoadWhenEmpty({
        count: 5,
        hasMore: true,
        loading: false,
        onLoadMore,
      }),
    );
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('does not loop when the server keeps returning empty + hasMore', () => {
    const onLoadMore = jest.fn();
    const { rerender } = renderHook(props => useAutoLoadWhenEmpty(props), {
      initialProps: {
        count: 0,
        hasMore: true,
        loading: false,
        onLoadMore,
      },
    });
    // Mimic a fetch that flips loading on then off again with the same count.
    rerender({ count: 0, hasMore: true, loading: true, onLoadMore });
    rerender({ count: 0, hasMore: true, loading: false, onLoadMore });
    rerender({ count: 0, hasMore: true, loading: false, onLoadMore });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('rearms when the count changes (filter switch / fresh query)', () => {
    const onLoadMore = jest.fn();
    const { rerender } = renderHook(props => useAutoLoadWhenEmpty(props), {
      initialProps: {
        count: 0,
        hasMore: true,
        loading: false,
        onLoadMore,
      },
    });
    // First attempt fires once.
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // Got results, gate resets.
    rerender({ count: 5, hasMore: true, loading: false, onLoadMore });
    // User changes filter, list goes empty again.
    rerender({ count: 0, hasMore: true, loading: false, onLoadMore });
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });
});
