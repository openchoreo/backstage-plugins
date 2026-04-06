import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { useTraces } from './useTraces';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useTraces', () => {
  const getTraces = jest.fn();

  const baseEnvironment = {
    name: 'development',
    namespace: 'dev',
    isProduction: false,
    createdAt: '2026-01-01T00:00:00Z',
  };

  const baseFilters = {
    environment: baseEnvironment,
    timeRange: '1h',
  };

  const entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: 'project-a',
      annotations: { 'openchoreo.io/namespace': 'dev' },
    },
    spec: { owner: 'group:default/team' },
  };

  const makeTrace = (id: string, startTime: string) => ({
    traceId: id,
    spanCount: 1,
    startTime,
    endTime: startTime,
    durationNs: 1000,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useApi as jest.Mock).mockReturnValue({ getTraces });
  });

  it('makes a single call with no component when no components are selected', async () => {
    getTraces.mockResolvedValueOnce({
      traces: [makeTrace('trace-1', '2026-03-05T10:00:00.000Z')],
      total: 1,
      tookMs: 5,
    });

    const { result } = renderHook(() =>
      useTraces({ ...baseFilters, componentIds: [] }, entity as any),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getTraces).toHaveBeenCalledTimes(1);
    expect(getTraces).toHaveBeenCalledWith(
      'dev',
      'project-a',
      'development',
      undefined,
      expect.any(Object),
    );
    expect(result.current.traces).toHaveLength(1);
    expect(result.current.total).toBe(1);
  });

  it('makes one call per selected component using component name', async () => {
    getTraces
      .mockResolvedValueOnce({
        traces: [makeTrace('trace-a', '2026-03-05T10:00:00.000Z')],
        total: 1,
        tookMs: 5,
      })
      .mockResolvedValueOnce({
        traces: [makeTrace('trace-b', '2026-03-05T10:01:00.000Z')],
        total: 1,
        tookMs: 5,
      });

    const { result } = renderHook(() =>
      useTraces(
        { ...baseFilters, componentIds: ['component-a', 'component-b'] },
        entity as any,
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(getTraces).toHaveBeenCalledTimes(2);
    expect(getTraces).toHaveBeenNthCalledWith(
      1,
      'dev',
      'project-a',
      'development',
      'component-a',
      expect.any(Object),
    );
    expect(getTraces).toHaveBeenNthCalledWith(
      2,
      'dev',
      'project-a',
      'development',
      'component-b',
      expect.any(Object),
    );
    expect(result.current.traces).toHaveLength(2);
    expect(result.current.total).toBe(2); // deduplicated count
  });

  it('deduplicates traces by traceId and reflects deduplicated count in total', async () => {
    getTraces
      .mockResolvedValueOnce({
        traces: [
          makeTrace('shared-trace', '2026-03-05T10:00:00.000Z'),
          makeTrace('trace-a', '2026-03-05T10:01:00.000Z'),
        ],
        total: 2, // server-side total for component-a
        tookMs: 5,
      })
      .mockResolvedValueOnce({
        // Same traceId returned from a second component (distributed trace)
        traces: [
          makeTrace('shared-trace', '2026-03-05T10:00:00.000Z'),
          makeTrace('trace-b', '2026-03-05T10:02:00.000Z'),
        ],
        total: 2, // server-side total for component-b
        tookMs: 5,
      });

    const { result } = renderHook(() =>
      useTraces(
        { ...baseFilters, componentIds: ['component-a', 'component-b'] },
        entity as any,
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Only 3 unique trace despite 2 responses — total must not be summed to 4
    expect(result.current.traces).toHaveLength(3);
    // sorted descending by startTime
    expect(result.current.traces[0].traceId).toBe('trace-b');
    expect(result.current.traces[1].traceId).toBe('trace-a');
    expect(result.current.traces[2].traceId).toBe('shared-trace');
    expect(result.current.total).toBe(3); // deduplicated total should reflect unique traces
  });

  it('sorts merged traces by startTime descending', async () => {
    getTraces
      .mockResolvedValueOnce({
        traces: [makeTrace('trace-oldest', '2026-03-05T10:00:00.000Z')],
        total: 1,
        tookMs: 5,
      })
      .mockResolvedValueOnce({
        traces: [makeTrace('trace-newest', '2026-03-05T10:02:00.000Z')],
        total: 1,
        tookMs: 5,
      });

    const { result } = renderHook(() =>
      useTraces(
        { ...baseFilters, componentIds: ['component-a', 'component-b'] },
        entity as any,
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.traces.map(t => t.traceId)).toEqual([
      'trace-newest',
      'trace-oldest',
    ]);
  });
});
