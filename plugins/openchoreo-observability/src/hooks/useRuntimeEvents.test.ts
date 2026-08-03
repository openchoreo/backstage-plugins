import { act, renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useRuntimeEvents } from './useRuntimeEvents';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useRuntimeEvents', () => {
  const getRuntimeEvents = jest.fn();

  const entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: 'api-service',
      annotations: { 'openchoreo.io/component': 'api-service' },
    },
    spec: { owner: 'group:default/team' },
  };

  const baseOptions = {
    environment: 'development',
    timeRange: '1h',
    limit: 50,
    sortOrder: 'asc' as const,
    isLive: false,
  };

  const renderEvents = (options: Record<string, unknown> = {}) =>
    renderHook(
      () =>
        useRuntimeEvents(entity as any, 'dev-ns', 'project-a', {
          ...baseOptions,
          ...options,
        }),
      { wrapper: createQueryWrapper() },
    );

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getRuntimeEvents });
  });

  it('fetches events and sets events + totalCount on reset', async () => {
    getRuntimeEvents.mockResolvedValueOnce({
      events: [
        {
          timestamp: '2026-03-05T10:00:00.000Z',
          message: 'started',
          type: 'Normal',
        },
        {
          timestamp: '2026-03-05T10:01:00.000Z',
          message: 'scaled',
          type: 'Normal',
        },
      ],
      total: 2,
    });

    // Auto-fetch on mount replaces the old explicit fetchEvents(true) trigger.
    const { result } = renderEvents();

    await waitFor(() => expect(result.current.events).toHaveLength(2));

    expect(getRuntimeEvents).toHaveBeenCalledWith(
      'dev-ns',
      'project-a',
      'development',
      'api-service',
      expect.objectContaining({ limit: 50, sortOrder: 'asc' }),
    );
    expect(result.current.totalCount).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('does not call the API when no environment is selected', async () => {
    // Empty env disables the query, so nothing fetches on mount.
    const { result } = renderEvents({ environment: '' });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getRuntimeEvents).not.toHaveBeenCalled();
    expect(result.current.events).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when the component annotation is missing', async () => {
    // Renamed from "sets an error ...": a missing component annotation now
    // disables the query (enabled:false) rather than raising the old
    // "Component name not found" error.
    const { result } = renderHook(
      () =>
        useRuntimeEvents(
          { ...entity, metadata: { name: 'x', annotations: {} } } as any,
          'dev-ns',
          'project-a',
          baseOptions,
        ),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getRuntimeEvents).not.toHaveBeenCalled();
    expect(result.current.events).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it('captures API errors', async () => {
    getRuntimeEvents.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderEvents();

    // Error surfaces from the auto-fetch (test client has retry disabled).
    await waitFor(() => expect(result.current.error).toBe('boom'));
  });

  it('falls back to a generic message for non-Error rejections', async () => {
    getRuntimeEvents.mockRejectedValueOnce('weird');

    const { result } = renderEvents();

    // TanStack surfaces the raw thrown string; the hook reads `.message`
    // (undefined on a string), so the 'Failed to fetch events' fallback wins.
    await waitFor(() =>
      expect(result.current.error).toBe('Failed to fetch events'),
    );
  });

  it('sets hasMore=true when a full page is returned', async () => {
    getRuntimeEvents.mockResolvedValueOnce({
      events: Array.from({ length: 50 }, (_, i) => ({
        timestamp: `t${i}`,
        message: `m${i}`,
      })),
      total: 100,
    });

    const { result } = renderEvents({ limit: 50 });

    await waitFor(() => expect(result.current.events).toHaveLength(50));

    expect(result.current.hasMore).toBe(true);
  });

  it('sets hasMore=false when a partial page is returned', async () => {
    getRuntimeEvents.mockResolvedValueOnce({
      events: [{ timestamp: 't', message: 'm' }],
      total: 1,
    });

    const { result } = renderEvents({ limit: 50 });

    await waitFor(() => expect(result.current.events).toHaveLength(1));

    expect(result.current.hasMore).toBe(false);
  });

  it('appends events and paginates by last timestamp (asc) on load more', async () => {
    getRuntimeEvents
      .mockResolvedValueOnce({
        events: Array.from({ length: 50 }, (_, i) => ({
          timestamp: `2026-03-05T10:${String(i).padStart(2, '0')}:00.000Z`,
          message: `m${i}`,
        })),
        total: 100,
      })
      .mockResolvedValueOnce({
        events: [{ timestamp: '2026-03-05T11:00:00.000Z', message: 'next' }],
        total: 100,
      });

    const { result } = renderEvents({ limit: 50, sortOrder: 'asc' });

    // First page auto-fetches; loadMore() replaces the old fetchEvents(false).
    await waitFor(() => expect(result.current.events).toHaveLength(50));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.events).toHaveLength(51));

    // call[0] = auto-fetched page 1, call[1] = loadMore page 2 (indices unchanged).
    const secondCallOptions = getRuntimeEvents.mock.calls[1][4];
    expect(secondCallOptions.startTime).toBe('2026-03-05T10:49:00.000Z');
  });

  it('paginates by last timestamp (desc) on load more', async () => {
    getRuntimeEvents
      .mockResolvedValueOnce({
        events: Array.from({ length: 50 }, (_, i) => ({
          timestamp: `2026-03-05T10:${String(i).padStart(2, '0')}:00.000Z`,
          message: `m${i}`,
        })),
        total: 100,
      })
      .mockResolvedValueOnce({
        events: [{ timestamp: '2026-03-05T09:00:00.000Z', message: 'older' }],
        total: 100,
      });

    const { result } = renderEvents({ limit: 50, sortOrder: 'desc' });

    await waitFor(() => expect(result.current.events).toHaveLength(50));

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.events).toHaveLength(51));

    const secondCallOptions = getRuntimeEvents.mock.calls[1][4];
    expect(secondCallOptions.endTime).toBe('2026-03-05T10:49:00.000Z');
  });

  it('clearEvents triggers a refetch from page 1', async () => {
    // clearEvents is now an alias for refresh(): it re-fetches page 1 rather
    // than emptying the list. Assert it re-invokes the API and reloads events.
    getRuntimeEvents
      .mockResolvedValueOnce({
        events: [{ timestamp: 't', message: 'm' }],
        total: 1,
      })
      .mockResolvedValueOnce({
        events: [{ timestamp: 't2', message: 'm2' }],
        total: 1,
      });

    const { result } = renderEvents();

    await waitFor(() => expect(result.current.events).toHaveLength(1));
    expect(getRuntimeEvents).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.clearEvents();
    });

    await waitFor(() => expect(getRuntimeEvents).toHaveBeenCalledTimes(2));
    expect(result.current.events).toHaveLength(1);
  });

  it('sets up 5s polling when isLive is true', async () => {
    jest.useFakeTimers();
    try {
      getRuntimeEvents.mockResolvedValue({ events: [], total: 0 });
      renderEvents({ isLive: true });

      // Auto-fetch fires on mount now (not only after the 5s interval).
      await waitFor(() => expect(getRuntimeEvents).toHaveBeenCalledTimes(1));

      await act(async () => {
        await jest.advanceTimersByTimeAsync(5000);
      });

      await waitFor(() => expect(getRuntimeEvents).toHaveBeenCalledTimes(2));
    } finally {
      jest.useRealTimers();
    }
  });
});
