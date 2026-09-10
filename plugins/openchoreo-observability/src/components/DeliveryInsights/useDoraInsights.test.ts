import { renderHook, waitFor, act } from '@testing-library/react';
import { useApi } from '@backstage/core-plugin-api';
import { useDoraInsights } from './useDoraInsights';
import type { DoraMetricsResponse } from '../../types';

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: jest.fn(),
}));

const getDoraMetrics = jest.fn();
(useApi as jest.Mock).mockReturnValue({ getDoraMetrics });

const response = (total: number): DoraMetricsResponse =>
  ({
    scope: { namespace: 'default' },
    granularity: 'daily',
    window: {
      startTime: '2026-07-01T00:00:00.000Z',
      endTime: '2026-07-31T00:00:00.000Z',
      generatedAt: '2026-07-31T00:00:00.000Z',
    },
    summary: { deploymentFrequency: { total } },
    series: {},
  } as unknown as DoraMetricsResponse);

describe('useDoraInsights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the metrics for the requested scope', async () => {
    getDoraMetrics.mockResolvedValue(response(7));
    const { result } = renderHook(() =>
      useDoraInsights({ namespace: 'default' }, 30, 'daily'),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.summary.deploymentFrequency?.total).toBe(7);
    expect(result.current.error).toBeNull();
  });

  it('does not surface the previous scope’s data when the new query fails', async () => {
    getDoraMetrics.mockResolvedValueOnce(response(7));
    const { result, rerender } = renderHook(
      ({ project }: { project?: string }) =>
        useDoraInsights({ namespace: 'default', project }, 30, 'daily'),
      { initialProps: {} as { project?: string } },
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    // Switching scope to a project whose query fails must not leave the
    // namespace-wide numbers on screen under the new breadcrumb.
    getDoraMetrics.mockRejectedValueOnce(new Error('observer unavailable'));
    rerender({ project: 'checkout' });

    await waitFor(() =>
      expect(result.current.error).toBe('observer unavailable'),
    );
    expect(result.current.data).toBeNull();
  });

  it('withholds data belonging to a stale window even before the new one lands', async () => {
    getDoraMetrics.mockResolvedValueOnce(response(7));
    const { result, rerender } = renderHook(
      ({ days }: { days: number }) =>
        useDoraInsights({ namespace: 'default' }, days, 'daily'),
      { initialProps: { days: 30 } },
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    // A never-resolving request models the in-flight window.
    getDoraMetrics.mockReturnValueOnce(new Promise(() => {}));
    rerender({ days: 90 });
    expect(result.current.data).toBeNull();
  });

  it('keeps the last good data when a refresh of the same scope fails', async () => {
    getDoraMetrics.mockResolvedValueOnce(response(7));
    const { result } = renderHook(() =>
      useDoraInsights({ namespace: 'default' }, 30, 'daily'),
    );
    await waitFor(() => expect(result.current.data).not.toBeNull());

    getDoraMetrics.mockRejectedValueOnce(new Error('transient blip'));
    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.error).toBe('transient blip'));
    // Same scope, so the previous snapshot is still accurate for it.
    expect(result.current.data?.summary.deploymentFrequency?.total).toBe(7);
  });

  it('drops a failed query’s error once the scope is cleared', async () => {
    getDoraMetrics.mockRejectedValueOnce(new Error('observer unavailable'));
    const { result, rerender } = renderHook(
      ({ scope }: { scope: { namespace: string } | null }) =>
        useDoraInsights(scope, 30, 'daily'),
      { initialProps: { scope: { namespace: 'default' } } as any },
    );
    await waitFor(() =>
      expect(result.current.error).toBe('observer unavailable'),
    );

    // Clearing the scope early-returns from the effect without fetching, so an
    // unkeyed error would remain on screen with nothing running behind it.
    rerender({ scope: null } as any);
    expect(result.current.error).toBeNull();
  });

  it('stays idle without a scope', async () => {
    const { result } = renderHook(() => useDoraInsights(null, 30, 'daily'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getDoraMetrics).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });
});
