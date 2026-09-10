import { getEventListeners } from 'events';
import { fetchAllPages } from './pagination-utils';

describe('fetchAllPages', () => {
  it('returns items from a single page with no cursor', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      items: [{ id: 1 }, { id: 2 }],
      pagination: {},
    });

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith(undefined);
  });

  it('concatenates items across multiple pages', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        pagination: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        pagination: { nextCursor: 'cursor-2' },
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }],
        pagination: {},
      });

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(fetchPage).toHaveBeenNthCalledWith(1, undefined);
    expect(fetchPage).toHaveBeenNthCalledWith(2, 'cursor-1');
    expect(fetchPage).toHaveBeenNthCalledWith(3, 'cursor-2');
  });

  it('returns empty array for empty first page', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      items: [],
      pagination: {},
    });

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('handles missing pagination field', async () => {
    const fetchPage = jest.fn().mockResolvedValue({
      items: [{ id: 1 }],
    });

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([{ id: 1 }]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from fetch function', async () => {
    const fetchPage = jest.fn().mockRejectedValue(new Error('Network error'));

    await expect(fetchAllPages(fetchPage)).rejects.toThrow('Network error');
  });

  it('propagates errors from second page fetch', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        pagination: { nextCursor: 'cursor-1' },
      })
      .mockRejectedValueOnce(new Error('Page 2 failed'));

    await expect(fetchAllPages(fetchPage)).rejects.toThrow('Page 2 failed');
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('stops when nextCursor is undefined', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        pagination: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        pagination: { nextCursor: undefined },
      });

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});

async function captureError(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run();
  } catch (error) {
    return error as Error;
  }
  throw new Error('Expected the operation to reject, but it resolved');
}

describe('fetchAllPages hardening', () => {
  it('throws when fetchPage resolves undefined, naming the page index', async () => {
    const fetchPage = jest.fn().mockResolvedValue(undefined);

    const error = await captureError(() => fetchAllPages(fetchPage));

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('page 0');
    expect(error.message).toContain('undefined');
  });

  it('throws when a page has no items array', async () => {
    const fetchPage = jest.fn().mockResolvedValue({});

    const error = await captureError(() => fetchAllPages(fetchPage));

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('page 0');
    expect(error.message).toContain('items');
  });

  it('throws when the next cursor repeats the cursor used to fetch the page', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        pagination: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        pagination: { nextCursor: 'cursor-1' },
      });

    const error = await captureError(() => fetchAllPages(fetchPage));

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('stuck');
    // The error must name the cursor value that is not advancing.
    expect(error.message).toContain('"cursor-1"');
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('stops when nextCursor is null', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        pagination: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        pagination: { nextCursor: null },
      });

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('stops when nextCursor is an empty string', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        pagination: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        pagination: { nextCursor: '' },
      });

    const result = await fetchAllPages(fetchPage);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('throws when fetching more pages than maxPages allows', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }, { id: 2 }],
        pagination: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        items: [{ id: 3 }, { id: 4 }],
        pagination: { nextCursor: 'cursor-2' },
      })
      .mockResolvedValueOnce({
        items: [{ id: 5 }, { id: 6 }],
        pagination: {},
      });

    const error = await captureError(() =>
      fetchAllPages(fetchPage, { maxPages: 2 }),
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain('maxPages of 2');
    expect(error.message).toContain('6 items');
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('does not throw when the page count exactly reaches maxPages', async () => {
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        pagination: { nextCursor: 'cursor-1' },
      })
      .mockResolvedValueOnce({
        items: [{ id: 2 }],
        pagination: {},
      });

    const result = await fetchAllPages(fetchPage, { maxPages: 2 });

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});

describe('fetchAllPages timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (jest.getTimerCount() !== 0) {
      throw new Error(`leaked ${jest.getTimerCount()} fake timer(s)`);
    }
    jest.useRealTimers();
  });

  it('rejects when the default overall timeout expires', async () => {
    const fetchPage = jest.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(
            () => resolve({ items: [{ id: 1 }], pagination: {} }),
            120_000,
          );
        }),
    );

    const settled = fetchAllPages(fetchPage).catch(error => error);

    await jest.advanceTimersByTimeAsync(60_000);
    const error = (await settled) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Pagination timed out after 60000 ms');

    // Let the abandoned fetch settle so no fake timers are left pending.
    await jest.advanceTimersByTimeAsync(60_000);
  });

  it('does not time out when timeoutMs is 0', async () => {
    const fetchPage = jest.fn().mockImplementation(
      () =>
        new Promise(resolve => {
          setTimeout(
            () => resolve({ items: [{ id: 1 }], pagination: {} }),
            120_000,
          );
        }),
    );

    const pending = fetchAllPages(fetchPage, { timeoutMs: 0 });

    // Far beyond the 60s default budget; the run must still complete.
    await jest.advanceTimersByTimeAsync(120_000);

    await expect(pending).resolves.toEqual([{ id: 1 }]);
  });
});

describe('fetchAllPages cancellation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    if (jest.getTimerCount() !== 0) {
      throw new Error(`leaked ${jest.getTimerCount()} fake timer(s)`);
    }
    jest.useRealTimers();
  });

  it('rejects without fetching when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchPage = jest.fn();

    const error = await captureError(() =>
      fetchAllPages(fetchPage, { signal: controller.signal }),
    );

    expect(error.name).toBe('AbortError');
    expect(error.message).toContain('Pagination aborted');
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('rejects when the signal is aborted after the first page', async () => {
    const controller = new AbortController();
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 1 }],
        pagination: { nextCursor: 'cursor-1' },
      })
      .mockImplementationOnce(() => {
        controller.abort();
        return new Promise(() => {});
      });

    const error = await captureError(() =>
      fetchAllPages(fetchPage, { signal: controller.signal }),
    );

    expect(error.name).toBe('AbortError');
    expect(error.message).toContain('Pagination aborted');
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('removes its timer and abort listener once it completes', async () => {
    const controller = new AbortController();
    const fetchPage = jest.fn().mockResolvedValue({
      items: [{ id: 1 }],
      pagination: {},
    });

    const result = await fetchAllPages(fetchPage, {
      signal: controller.signal,
    });

    expect(result).toEqual([{ id: 1 }]);
    expect(jest.getTimerCount()).toBe(0);
    expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  });
});
