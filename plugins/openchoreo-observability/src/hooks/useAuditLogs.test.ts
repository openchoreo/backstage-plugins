import { act, renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useAuditLogs } from './useAuditLogs';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useAuditLogs', () => {
  const queryAuditLogs = jest.fn();

  const auditWindow = {
    startTime: '2026-09-01T00:00:00.000Z',
    endTime: '2026-09-08T00:00:00.000Z',
    clamped: false,
  };

  const options = {
    window: auditWindow,
    tokens: [],
    sortOrder: 'desc' as const,
    limit: 2,
  };

  const makeRecord = (id: string, eventTime: string) => ({
    event_id: id,
    event_time: eventTime,
    action: 'component.update',
    result: 'success',
  });

  const lastBody = () =>
    queryAuditLogs.mock.calls[queryAuditLogs.mock.calls.length - 1][0];

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ queryAuditLogs });
  });

  it('moves the window up to now while Live is on', async () => {
    queryAuditLogs.mockResolvedValue({ records: [], total: 0, tookMs: 1 });

    renderHook(() => useAuditLogs({ ...options, isLive: true }), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(queryAuditLogs).toHaveBeenCalled());

    // The window is resolved once and then pinned, so polling it unchanged
    // would ask about a period that ended before Live was switched on and no
    // new record could ever fall inside it.
    expect(lastBody().endTime).not.toBe(auditWindow.endTime);
    expect(new Date(lastBody().endTime).getTime()).toBeGreaterThan(
      new Date(auditWindow.endTime).getTime(),
    );
    // The lower bound is the user's window and must not drift.
    expect(lastBody().startTime).toBe(auditWindow.startTime);
  });

  it('leaves the window exactly as given when Live is off', async () => {
    queryAuditLogs.mockResolvedValue({ records: [], total: 0, tookMs: 1 });

    renderHook(() => useAuditLogs(options), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(queryAuditLogs).toHaveBeenCalled());

    expect(lastBody().endTime).toBe(auditWindow.endTime);
  });

  it('asks for the whole window on the first page', async () => {
    queryAuditLogs.mockResolvedValueOnce({
      records: [makeRecord('a', '2026-09-05T10:00:00.000Z')],
      total: 1,
    });

    const { result } = renderHook(() => useAuditLogs(options), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(lastBody()).toMatchObject({
      startTime: auditWindow.startTime,
      endTime: auditWindow.endTime,
    });
    // A short page is the end of the window.
    expect(result.current.hasMore).toBe(false);
  });

  it('continues a descending read by closing endTime down to the last record', async () => {
    queryAuditLogs
      .mockResolvedValueOnce({
        records: [
          makeRecord('a', '2026-09-05T10:00:00.000Z'),
          makeRecord('b', '2026-09-04T10:00:00.000Z'),
        ],
      })
      .mockResolvedValueOnce({
        records: [makeRecord('c', '2026-09-03T10:00:00.000Z')],
      });

    const { result } = renderHook(() => useAuditLogs(options), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.records).toHaveLength(3));

    // endTime is exclusive, so the boundary record is not read twice.
    expect(lastBody()).toMatchObject({
      startTime: auditWindow.startTime,
      endTime: '2026-09-04T10:00:00.000Z',
    });
    expect(result.current.hasMore).toBe(false);
  });

  it('continues an ascending read by raising startTime, and drops the repeat', async () => {
    queryAuditLogs
      .mockResolvedValueOnce({
        records: [
          makeRecord('a', '2026-09-02T10:00:00.000Z'),
          makeRecord('b', '2026-09-03T10:00:00.000Z'),
        ],
      })
      .mockResolvedValueOnce({
        // startTime is inclusive, so the boundary record comes back again.
        records: [
          makeRecord('b', '2026-09-03T10:00:00.000Z'),
          makeRecord('c', '2026-09-04T10:00:00.000Z'),
        ],
      });

    const { result } = renderHook(
      () => useAuditLogs({ ...options, sortOrder: 'asc' }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.records).toHaveLength(3));

    expect(lastBody()).toMatchObject({
      startTime: '2026-09-03T10:00:00.000Z',
      endTime: auditWindow.endTime,
    });
    // The table keys rows by event_id, so the repeat must not reach it.
    expect(result.current.records.map(r => r.event_id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('stops rather than re-asking when a full page shares one event_time', async () => {
    // A tie group wider than a page cannot move the boundary, so continuing
    // would request the same window forever.
    queryAuditLogs.mockResolvedValue({
      records: [
        makeRecord('a', '2026-09-05T10:00:00.000Z'),
        makeRecord('b', '2026-09-05T10:00:00.000Z'),
      ],
    });

    const { result } = renderHook(
      () => useAuditLogs({ ...options, sortOrder: 'asc' }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    await waitFor(() => expect(queryAuditLogs).toHaveBeenCalledTimes(2));

    // The second page could not advance the boundary, so there is no third.
    await waitFor(() => expect(result.current.hasMore).toBe(false));
  });

  it('stops when the boundary reaches the edge of the window', async () => {
    queryAuditLogs.mockResolvedValueOnce({
      records: [
        makeRecord('a', '2026-09-05T10:00:00.000Z'),
        // Already at startTime: closing endTime to it would be a 400.
        makeRecord('b', auditWindow.startTime),
      ],
    });

    const { result } = renderHook(() => useAuditLogs(options), {
      wrapper: createQueryWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasMore).toBe(false);
  });

  it('withholds hasMore while live, so the list stays the newest page', async () => {
    queryAuditLogs.mockResolvedValue({
      records: [
        makeRecord('a', '2026-09-05T10:00:00.000Z'),
        makeRecord('b', '2026-09-04T10:00:00.000Z'),
      ],
    });

    const { result } = renderHook(
      () => useAuditLogs({ ...options, isLive: true }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.records).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('keeps the records fetched while live when Live is turned off', async () => {
    queryAuditLogs.mockResolvedValue({
      records: [
        makeRecord('a', '2026-09-05T10:00:00.000Z'),
        makeRecord('b', '2026-09-04T10:00:00.000Z'),
      ],
    });

    const { result, rerender } = renderHook(
      ({ isLive }) => useAuditLogs({ ...options, isLive }),
      { wrapper: createQueryWrapper(), initialProps: { isLive: true } },
    );

    await waitFor(() => expect(result.current.records).toHaveLength(2));
    const calls = queryAuditLogs.mock.calls.length;

    rerender({ isLive: false });

    expect(result.current.loading).toBe(false);
    expect(result.current.records.map(r => r.event_id)).toEqual(['a', 'b']);
    expect(queryAuditLogs).toHaveBeenCalledTimes(calls);
    expect(result.current.hasMore).toBe(true);
  });

  it('does not query while the permission check withholds enabled', () => {
    const { result } = renderHook(
      () => useAuditLogs({ ...options, enabled: false }),
      { wrapper: createQueryWrapper() },
    );

    expect(queryAuditLogs).not.toHaveBeenCalled();
    expect(result.current.records).toEqual([]);
  });
});
