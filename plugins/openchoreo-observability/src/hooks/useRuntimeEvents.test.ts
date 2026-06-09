import { act, renderHook } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
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
    renderHook(() =>
      useRuntimeEvents(entity as any, 'dev-ns', 'project-a', {
        ...baseOptions,
        ...options,
      }),
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

    const { result } = renderEvents();

    await act(async () => {
      await result.current.fetchEvents(true);
    });

    expect(getRuntimeEvents).toHaveBeenCalledWith(
      'dev-ns',
      'project-a',
      'development',
      'api-service',
      expect.objectContaining({ limit: 50, sortOrder: 'asc' }),
    );
    expect(result.current.events).toHaveLength(2);
    expect(result.current.totalCount).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('does not call the API when no environment is selected', async () => {
    const { result } = renderEvents({ environment: '' });

    await act(async () => {
      await result.current.fetchEvents(true);
    });

    expect(getRuntimeEvents).not.toHaveBeenCalled();
  });

  it('sets an error when the component annotation is missing', async () => {
    const { result } = renderHook(() =>
      useRuntimeEvents(
        { ...entity, metadata: { name: 'x', annotations: {} } } as any,
        'dev-ns',
        'project-a',
        baseOptions,
      ),
    );

    await act(async () => {
      await result.current.fetchEvents(true);
    });

    expect(getRuntimeEvents).not.toHaveBeenCalled();
    expect(result.current.error).toBe(
      'Component name not found in entity annotations',
    );
  });

  it('captures API errors', async () => {
    getRuntimeEvents.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderEvents();

    await act(async () => {
      await result.current.fetchEvents(true);
    });

    expect(result.current.error).toBe('boom');
  });

  it('falls back to a generic message for non-Error rejections', async () => {
    getRuntimeEvents.mockRejectedValueOnce('weird');

    const { result } = renderEvents();

    await act(async () => {
      await result.current.fetchEvents(true);
    });

    expect(result.current.error).toBe('Failed to fetch events');
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

    await act(async () => {
      await result.current.fetchEvents(true);
    });

    expect(result.current.hasMore).toBe(true);
  });

  it('sets hasMore=false when a partial page is returned', async () => {
    getRuntimeEvents.mockResolvedValueOnce({
      events: [{ timestamp: 't', message: 'm' }],
      total: 1,
    });

    const { result } = renderEvents({ limit: 50 });

    await act(async () => {
      await result.current.fetchEvents(true);
    });

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

    await act(async () => {
      await result.current.fetchEvents(true);
    });
    await act(async () => {
      await result.current.fetchEvents(false);
    });

    expect(result.current.events).toHaveLength(51);
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

    await act(async () => {
      await result.current.fetchEvents(true);
    });
    await act(async () => {
      await result.current.fetchEvents(false);
    });

    const secondCallOptions = getRuntimeEvents.mock.calls[1][4];
    expect(secondCallOptions.endTime).toBe('2026-03-05T10:49:00.000Z');
  });

  it('clearEvents resets events, totalCount and hasMore', async () => {
    getRuntimeEvents.mockResolvedValueOnce({
      events: [{ timestamp: 't', message: 'm' }],
      total: 1,
    });

    const { result } = renderEvents();

    await act(async () => {
      await result.current.fetchEvents(true);
    });

    act(() => {
      result.current.clearEvents();
    });

    expect(result.current.events).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.hasMore).toBe(true);
  });

  it('sets up 5s polling when isLive is true', async () => {
    jest.useFakeTimers();
    try {
      getRuntimeEvents.mockResolvedValue({ events: [], total: 0 });
      renderEvents({ isLive: true });

      expect(getRuntimeEvents).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(getRuntimeEvents).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
