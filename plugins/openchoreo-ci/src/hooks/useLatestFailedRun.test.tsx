/**
 * Tests for useLatestFailedRun.
 *
 * The hook composes useWorkflowData() with a 30s self-scheduling poll
 * loop. We mock useWorkflowData (it has its own tests + integration
 * surface area) so the focus here is on:
 *   - the polling loop's no-overlap invariant,
 *   - the ``hasActiveBuilds`` gate that suppresses the loop while a
 *     build is pending/running,
 *   - error logging instead of silent swallowing,
 *   - cleanup on unmount + dep changes,
 *   - latestRun / isFailed derivation.
 */
import { renderHook, act } from '@testing-library/react';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';

import { useLatestFailedRun } from './useLatestFailedRun';

// Mockable view of what useWorkflowData() returns.
const mockUseWorkflowData = jest.fn();

jest.mock('./useWorkflowData', () => ({
  useWorkflowData: () => mockUseWorkflowData(),
}));

function makeBuild(overrides: Partial<ModelsBuild> = {}): ModelsBuild {
  return {
    name: 'b1',
    status: 'Succeeded',
    createdAt: '2026-05-07T12:00:00Z',
    ...overrides,
  } as ModelsBuild;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockUseWorkflowData.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useLatestFailedRun', () => {
  describe('latestRun + isFailed derivation', () => {
    it('returns isFailed=false when the most recent build succeeded', () => {
      mockUseWorkflowData.mockReturnValue({
        builds: [makeBuild({ name: 'b1', status: 'Succeeded' })],
        componentDetails: null,
        loading: false,
        error: null,
        fetchBuilds: jest.fn(),
      });

      const { result } = renderHook(() => useLatestFailedRun());

      expect(result.current.latestRun?.name).toBe('b1');
      expect(result.current.isFailed).toBe(false);
    });

    it('returns isFailed=true when the latest build failed', () => {
      mockUseWorkflowData.mockReturnValue({
        builds: [
          makeBuild({
            name: 'b2',
            status: 'Failed',
            createdAt: '2026-05-07T13:00:00Z',
          }),
          makeBuild({
            name: 'b1',
            status: 'Succeeded',
            createdAt: '2026-05-07T12:00:00Z',
          }),
        ],
        componentDetails: null,
        loading: false,
        error: null,
        fetchBuilds: jest.fn(),
      });

      const { result } = renderHook(() => useLatestFailedRun());

      // pickLatest sorts by createdAt desc — b2 wins.
      expect(result.current.latestRun?.name).toBe('b2');
      expect(result.current.isFailed).toBe(true);
    });

    it('case-insensitive failure detection (Errored, error, FAILED all match)', () => {
      for (const status of ['Failed', 'Errored', 'error', 'FAILED']) {
        mockUseWorkflowData.mockReturnValue({
          builds: [makeBuild({ status })],
          componentDetails: null,
          loading: false,
          error: null,
          fetchBuilds: jest.fn(),
        });
        const { result } = renderHook(() => useLatestFailedRun());
        expect(result.current.isFailed).toBe(true);
      }
    });

    it('isFailed=false on empty builds (no latestRun)', () => {
      mockUseWorkflowData.mockReturnValue({
        builds: [],
        componentDetails: null,
        loading: false,
        error: null,
        fetchBuilds: jest.fn(),
      });
      const { result } = renderHook(() => useLatestFailedRun());
      expect(result.current.latestRun).toBeUndefined();
      expect(result.current.isFailed).toBe(false);
    });
  });

  describe('background refresh loop', () => {
    it('does NOT schedule a poll while builds are active (Pending/Running)', () => {
      const fetchBuilds = jest.fn().mockResolvedValue(undefined);
      mockUseWorkflowData.mockReturnValue({
        builds: [makeBuild({ status: 'Running' })],
        componentDetails: null,
        loading: false,
        error: null,
        fetchBuilds,
      });
      renderHook(() => useLatestFailedRun());

      // Advance well past 30s — fetchBuilds should still not have been
      // re-invoked because useWorkflowData's own polling owns active runs.
      act(() => {
        jest.advanceTimersByTime(60_000);
      });
      expect(fetchBuilds).not.toHaveBeenCalled();
    });

    it('schedules a fetchBuilds call after 30s when no active builds', async () => {
      const fetchBuilds = jest.fn().mockResolvedValue(undefined);
      mockUseWorkflowData.mockReturnValue({
        builds: [makeBuild({ status: 'Succeeded' })],
        componentDetails: null,
        loading: false,
        error: null,
        fetchBuilds,
      });
      renderHook(() => useLatestFailedRun());

      // Before 30s — no call yet.
      act(() => {
        jest.advanceTimersByTime(29_000);
      });
      expect(fetchBuilds).not.toHaveBeenCalled();

      // At 30s — first call fires.
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
      expect(fetchBuilds).toHaveBeenCalledTimes(1);
    });

    it('awaits each fetchBuilds before scheduling the next (no overlap)', async () => {
      // Make fetchBuilds slow — 50_000 ms — so a naive setInterval would
      // queue a second call at the 30 s mark. The setTimeout loop must
      // wait until the slow call resolves before starting the timer for
      // the next tick.
      let resolveSlow: (() => void) | undefined;
      const fetchBuilds = jest.fn(
        () =>
          new Promise<void>(res => {
            resolveSlow = res;
          }),
      );
      mockUseWorkflowData.mockReturnValue({
        builds: [makeBuild({ status: 'Succeeded' })],
        componentDetails: null,
        loading: false,
        error: null,
        fetchBuilds,
      });
      renderHook(() => useLatestFailedRun());

      // Trigger first call.
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(fetchBuilds).toHaveBeenCalledTimes(1);

      // Wait another 60 s while the first call is STILL pending. A
      // setInterval-based loop would have queued two more calls; ours
      // shouldn't because the first hasn't resolved.
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(fetchBuilds).toHaveBeenCalledTimes(1);

      // Resolve the first call. The loop should schedule the next tick.
      await act(async () => {
        resolveSlow?.();
        await Promise.resolve();
        jest.advanceTimersByTime(30_000);
      });
      expect(fetchBuilds).toHaveBeenCalledTimes(2);
    });

    it('logs the error to console.warn instead of swallowing', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const fetchBuilds = jest
        .fn()
        .mockRejectedValue(new Error('upstream 500'));
      mockUseWorkflowData.mockReturnValue({
        builds: [makeBuild({ status: 'Succeeded' })],
        componentDetails: null,
        loading: false,
        error: null,
        fetchBuilds,
      });
      renderHook(() => useLatestFailedRun());

      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });

      expect(warn).toHaveBeenCalledWith(
        'useLatestFailedRun: background refresh failed',
        expect.any(Error),
      );
      warn.mockRestore();
    });

    it('error in one tick does not break subsequent ticks', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const fetchBuilds = jest
        .fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValue(undefined);
      mockUseWorkflowData.mockReturnValue({
        builds: [makeBuild({ status: 'Succeeded' })],
        componentDetails: null,
        loading: false,
        error: null,
        fetchBuilds,
      });
      renderHook(() => useLatestFailedRun());

      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      // Allow the rejected promise to settle through the catch.
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(fetchBuilds).toHaveBeenCalledTimes(1);

      // Second tick must still fire after another 30s window.
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(fetchBuilds).toHaveBeenCalledTimes(2);
      warn.mockRestore();
    });

    it('cleans up the pending timer on unmount and does not call fetchBuilds afterwards', async () => {
      const fetchBuilds = jest.fn().mockResolvedValue(undefined);
      mockUseWorkflowData.mockReturnValue({
        builds: [makeBuild({ status: 'Succeeded' })],
        componentDetails: null,
        loading: false,
        error: null,
        fetchBuilds,
      });
      const { unmount } = renderHook(() => useLatestFailedRun());

      // Unmount BEFORE the 30s deadline — the timer is still pending.
      unmount();

      // Advance past the would-be deadline. The cleanup should have
      // cleared the timeout.
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(fetchBuilds).not.toHaveBeenCalled();
    });

    it('does not schedule a follow-up tick when unmount happens during the in-flight fetch', async () => {
      let resolveSlow: (() => void) | undefined;
      const fetchBuilds = jest.fn(
        () =>
          new Promise<void>(res => {
            resolveSlow = res;
          }),
      );
      mockUseWorkflowData.mockReturnValue({
        builds: [makeBuild({ status: 'Succeeded' })],
        componentDetails: null,
        loading: false,
        error: null,
        fetchBuilds,
      });
      const { unmount } = renderHook(() => useLatestFailedRun());

      // First tick fires.
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(fetchBuilds).toHaveBeenCalledTimes(1);

      // Unmount while fetch is still pending.
      unmount();

      // Resolve the fetch and advance past the next would-be deadline.
      // The ``cancelled`` flag must prevent a follow-up setTimeout.
      await act(async () => {
        resolveSlow?.();
        await Promise.resolve();
        jest.advanceTimersByTime(60_000);
      });
      expect(fetchBuilds).toHaveBeenCalledTimes(1);
    });
  });
});
