import { renderHook, act } from '@testing-library/react';
import { useInfiniteScroll } from './useInfiniteScroll';

const mockObserve = jest.fn();
const mockDisconnect = jest.fn();
const mockUnobserve = jest.fn();
const mockIntersectionObserver = jest.fn().mockImplementation(cb => {
  (mockIntersectionObserver as any)._callback = cb;
  return {
    observe: mockObserve,
    disconnect: mockDisconnect,
    unobserve: mockUnobserve,
  };
});
(global as any).IntersectionObserver = mockIntersectionObserver;

describe('useInfiniteScroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a loadingRef', () => {
    const { result } = renderHook(() =>
      useInfiniteScroll(jest.fn(), true, false),
    );

    expect(result.current.loadingRef).toBeDefined();
    expect(result.current.loadingRef).toHaveProperty('current');
  });

  it('creates observer when hasMore=true and loading=false', () => {
    renderHook(() => useInfiniteScroll(jest.fn(), true, false));

    expect(mockIntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.1, rootMargin: '200px' }),
    );
  });

  it('calls callback when element intersects', () => {
    const callback = jest.fn();
    const div = document.createElement('div');

    renderHook(() => {
      const hook = useInfiniteScroll(callback, true, false);
      // Manually assign the ref to simulate a mounted DOM element
      (hook.loadingRef as any).current = div;
      return hook;
    });

    // Simulate intersection
    act(() => {
      const observerCallback = (mockIntersectionObserver as any)._callback;
      observerCallback([{ isIntersecting: true }]);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call callback when element is not intersecting', () => {
    const callback = jest.fn();

    renderHook(() => useInfiniteScroll(callback, true, false));

    act(() => {
      const observerCallback = (mockIntersectionObserver as any)._callback;
      observerCallback([{ isIntersecting: false }]);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('does NOT create observer when loading=true', () => {
    mockIntersectionObserver.mockClear();

    renderHook(() => useInfiniteScroll(jest.fn(), true, true));

    expect(mockIntersectionObserver).not.toHaveBeenCalled();
  });

  it('does NOT create observer when hasMore=false', () => {
    mockIntersectionObserver.mockClear();

    renderHook(() => useInfiniteScroll(jest.fn(), false, false));

    expect(mockIntersectionObserver).not.toHaveBeenCalled();
  });

  it('disconnects on unmount', () => {
    const { unmount } = renderHook(() =>
      useInfiniteScroll(jest.fn(), true, false),
    );

    unmount();

    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('disconnects previous observer when dependencies change', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    const { rerender } = renderHook(
      ({ cb }) => useInfiniteScroll(cb, true, false),
      { initialProps: { cb: callback1 } },
    );

    expect(mockDisconnect).not.toHaveBeenCalled();

    rerender({ cb: callback2 });

    // Old observer should be disconnected before creating new one
    expect(mockDisconnect).toHaveBeenCalled();
  });
});
