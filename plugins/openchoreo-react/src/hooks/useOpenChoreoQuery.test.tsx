import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useOpenChoreoQuery } from './useOpenChoreoQuery';

function wrapperWith(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

describe('useOpenChoreoQuery', () => {
  it('reports loading on first load, then data with loading cleared', async () => {
    const fetcher = jest.fn().mockResolvedValue(['a', 'b']);
    const { result } = renderHook(
      () => useOpenChoreoQuery(['items'], fetcher),
      { wrapper: wrapperWith(freshClient()) },
    );

    // First render: no data yet → loading true, not refetching.
    expect(result.current.loading).toBe(true);
    expect(result.current.isRefetching).toBe(false);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual(['a', 'b']);
    expect(result.current.isRefetching).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('keeps data and flips isRefetching (not loading) on a background refetch', async () => {
    // Hold the second fetch open so the in-flight refresh is observable before
    // it resolves (an instantly-resolved refetch would flip isRefetching
    // true→false before waitFor could catch it).
    let releaseSecond: (v: string[]) => void = () => {};
    const secondPending = new Promise<string[]>(resolve => {
      releaseSecond = resolve;
    });
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(['first'])
      .mockReturnValueOnce(secondPending);
    const { result } = renderHook(
      () => useOpenChoreoQuery(['items'], fetcher),
      { wrapper: wrapperWith(freshClient()) },
    );

    await waitFor(() => expect(result.current.data).toEqual(['first']));

    // refetch() now returns a Promise; kick it inside act without awaiting the
    // resolve (it's held open by secondPending) but swallow to avoid an
    // unhandled rejection leaking into later tests.
    await act(async () => {
      result.current.refetch().catch(() => {});
    });

    // Data stays on screen; the in-flight refresh surfaces as isRefetching,
    // never as loading (loading is first-load only).
    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toEqual(['first']);

    await act(async () => {
      releaseSecond(['second']);
      await secondPending;
    });

    await waitFor(() => expect(result.current.data).toEqual(['second']));
    expect(result.current.isRefetching).toBe(false);
  });

  it('surfaces a rejected fetcher in error and never as data', async () => {
    const boom = new Error('403 Forbidden');
    const fetcher = jest.fn().mockRejectedValue(boom);
    const { result } = renderHook(
      () => useOpenChoreoQuery(['items'], fetcher),
      { wrapper: wrapperWith(freshClient()) },
    );

    await waitFor(() => expect(result.current.error).toBe(boom));
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });

  it('does not load or fetch when disabled', () => {
    const fetcher = jest.fn().mockResolvedValue(['x']);
    const { result } = renderHook(
      () => useOpenChoreoQuery(['items'], fetcher, { enabled: false }),
      { wrapper: wrapperWith(freshClient()) },
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('inherits the QueryClient staleTime when the caller omits it (no refetch on remount)', async () => {
    // Regression: the hook must NOT forward `staleTime: undefined` to useQuery.
    // TanStack treats an explicit `undefined` as an override that resolves to 0,
    // which marks the query stale immediately and refetches on every remount —
    // silently defeating the app-level 30s cache. A caller with no staleTime
    // should inherit the client default, so a remount within that window serves
    // from cache without re-invoking the fetcher.
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 60_000 } },
    });
    const fetcher = jest.fn().mockResolvedValue(['a']);
    const wrapper = wrapperWith(client);

    const first = renderHook(() => useOpenChoreoQuery(['items'], fetcher), {
      wrapper,
    });
    await waitFor(() => expect(first.result.current.data).toEqual(['a']));
    expect(fetcher).toHaveBeenCalledTimes(1);
    first.unmount();

    // Remount with the same key while the cache entry is still fresh.
    const second = renderHook(() => useOpenChoreoQuery(['items'], fetcher), {
      wrapper,
    });
    // Data is available synchronously from cache; no spinner, no new fetch.
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.data).toEqual(['a']);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
