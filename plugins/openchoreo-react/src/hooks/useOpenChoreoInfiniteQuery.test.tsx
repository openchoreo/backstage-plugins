import { renderHook, waitFor, act } from '@testing-library/react';
import { createQueryClientWrapper } from '@openchoreo/test-utils';
import {
  useOpenChoreoInfiniteQuery,
  type OpenChoreoPage,
} from './useOpenChoreoInfiniteQuery';

// A paged fetcher over a fixed dataset of numbers. Each page returns up to
// `pageSize` items and a cursor equal to the last item's index, so the next
// page starts after it. `total` is reported on every page (the hook reads it
// off page 1).
function makePagedFetcher(total: number, pageSize: number) {
  const all = Array.from({ length: total }, (_, i) => i);
  return jest.fn(async (cursor: string | undefined) => {
    const start = cursor === undefined ? 0 : Number(cursor) + 1;
    const items = all.slice(start, start + pageSize);
    const page: OpenChoreoPage<number> = { items, total };
    return page;
  });
}

// Cursor for the number list is just the item's own value as a string.
const getCursor = (lastItem: number) => String(lastItem);

describe('useOpenChoreoInfiniteQuery', () => {
  it('reports loading on first load, then the first page with total and hasMore', async () => {
    // 5 total, page size 2 → first page is [0, 1] with more to load.
    const fetcher = makePagedFetcher(5, 2);
    const { result } = renderHook(
      () =>
        useOpenChoreoInfiniteQuery(['logs'], fetcher, {
          getCursor,
          pageSize: 2,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    // First render: nothing loaded yet.
    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.isRefetching).toBe(false);
    expect(result.current.loadingMore).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([0, 1]);
    expect(result.current.totalCount).toBe(5);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.error).toBeNull();
    // A first load is never surfaced as a background refresh.
    expect(result.current.isRefetching).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(undefined);
  });

  it('loadMore fetches page 2 with the cursor and appends its items', async () => {
    const fetcher = makePagedFetcher(5, 2);
    const { result } = renderHook(
      () =>
        useOpenChoreoInfiniteQuery(['logs'], fetcher, {
          getCursor,
          pageSize: 2,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    await waitFor(() => expect(result.current.items).toEqual([0, 1]));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items).toEqual([0, 1, 2, 3]));
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loadingMore).toBe(false);
    // Page 2 was requested with the cursor derived from page 1's last item.
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenLastCalledWith('1');
  });

  it('ends pagination once a short (last) page arrives', async () => {
    // 3 total, page size 2 → page 1 = [0,1] (full → more), page 2 = [2] (short → end).
    const fetcher = makePagedFetcher(3, 2);
    const { result } = renderHook(
      () =>
        useOpenChoreoInfiniteQuery(['logs'], fetcher, {
          getCursor,
          pageSize: 2,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    await waitFor(() => expect(result.current.items).toEqual([0, 1]));
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.items).toEqual([0, 1, 2]));
    // Page 2 was shorter than pageSize → no further pages.
    expect(result.current.hasMore).toBe(false);

    // loadMore is a no-op once there is no next page.
    act(() => {
      result.current.loadMore();
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('flips isRefetching (not loading) during a background refresh and keeps items', async () => {
    // Hold the second fetch open so the in-flight refresh is observable.
    let releaseSecond: (v: OpenChoreoPage<number>) => void = () => {};
    const secondPending = new Promise<OpenChoreoPage<number>>(resolve => {
      releaseSecond = resolve;
    });
    const fetcher = jest
      .fn<Promise<OpenChoreoPage<number>>, [string | undefined]>()
      .mockResolvedValueOnce({ items: [0], total: 1 })
      .mockReturnValueOnce(secondPending);

    const { result } = renderHook(
      () =>
        useOpenChoreoInfiniteQuery(['logs'], fetcher, {
          getCursor,
          pageSize: 2,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    await waitFor(() => expect(result.current.items).toEqual([0]));
    expect(result.current.isRefetching).toBe(false);

    await act(async () => {
      result.current.refresh().catch(() => {});
    });

    // Data stays on screen; the in-flight refresh surfaces as isRefetching only.
    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual([0]);

    await act(async () => {
      releaseSecond({ items: [0], total: 1 });
      await secondPending;
    });

    await waitFor(() => expect(result.current.isRefetching).toBe(false));
  });

  it('returns empty items and never fetches when disabled', () => {
    const fetcher = makePagedFetcher(5, 2);
    const { result } = renderHook(
      () =>
        useOpenChoreoInfiniteQuery(['logs'], fetcher, {
          getCursor,
          pageSize: 2,
          enabled: false,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.totalCount).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('falls back to the loaded count for totalCount when the page omits total', async () => {
    const fetcher = jest.fn(
      async (): Promise<OpenChoreoPage<number>> => ({ items: [10, 20] }),
    );
    const { result } = renderHook(
      () =>
        useOpenChoreoInfiniteQuery(['logs'], fetcher, {
          getCursor,
          // pageSize 2 with a 2-item page would look like "more"; the short
          // heuristic keys on length >= pageSize, so use a bigger pageSize to
          // end pagination and pin totalCount to the loaded count.
          pageSize: 10,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([10, 20]);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('honours an explicit hasMore:false even on a full-length page', async () => {
    // Page is full (length === pageSize) but the fetcher declares no more.
    const fetcher = jest.fn(
      async (): Promise<OpenChoreoPage<number>> => ({
        items: [1, 2],
        total: 2,
        hasMore: false,
      }),
    );
    const { result } = renderHook(
      () =>
        useOpenChoreoInfiniteQuery(['logs'], fetcher, {
          getCursor,
          pageSize: 2,
        }),
      { wrapper: createQueryClientWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([1, 2]);
    expect(result.current.hasMore).toBe(false);
  });
});
