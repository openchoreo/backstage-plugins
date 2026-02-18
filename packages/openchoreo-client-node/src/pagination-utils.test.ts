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
