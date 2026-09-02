import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useUrlFiltersForPlatformLogs } from './useUrlFiltersForPlatformLogs';
import {
  DEFAULT_PLATFORM_LABEL_SELECTOR,
  DEFAULT_PLATFORM_LOG_FIELDS,
  PLATFORM_LOG_LEVELS,
  PlatformLogField,
} from '../components/PlatformLogs/types';

const renderFilters = (initialEntry = '/') =>
  renderHook(() => useUrlFiltersForPlatformLogs(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    ),
  });

describe('useUrlFiltersForPlatformLogs', () => {
  describe('parsing', () => {
    it('lands on the control plane with all levels and no other filters', () => {
      const { result } = renderFilters('/');

      expect(result.current.filters).toMatchObject({
        observabilityPlane: '',
        clusterInstances: [],
        namespaces: [],
        podNames: [],
        containerNames: [],
        labels: DEFAULT_PLATFORM_LABEL_SELECTOR,
        logLevel: PLATFORM_LOG_LEVELS,
        selectedFields: DEFAULT_PLATFORM_LOG_FIELDS,
        sortOrder: 'desc',
      });
    });

    // The distinction the whole "clear the filter to search everything" flow rests on:
    // an absent param means "use the default", an empty one means the operator removed
    // it. Collapsing the two would make the default impossible to get rid of.
    it('treats an explicitly empty labels param as no label filter', () => {
      const { result } = renderFilters('/?labels=');

      expect(result.current.filters.labels).toBe('');
    });

    it('reads comma-separated filter lists', () => {
      const { result } = renderFilters(
        '/?cluster=c1,c2&ns=openchoreo-control-plane&pod=pod-a,pod-b&container=manager',
      );

      expect(result.current.filters.clusterInstances).toEqual(['c1', 'c2']);
      expect(result.current.filters.namespaces).toEqual([
        'openchoreo-control-plane',
      ]);
      expect(result.current.filters.podNames).toEqual(['pod-a', 'pod-b']);
      expect(result.current.filters.containerNames).toEqual(['manager']);
    });

    it('ignores unknown log levels and unknown columns', () => {
      const { result } = renderFilters(
        '/?logLevel=ERROR,NOPE&fields=Timestamp,Bogus',
      );

      expect(result.current.filters.logLevel).toEqual(['ERROR']);
      expect(result.current.filters.selectedFields).toEqual([
        PlatformLogField.Timestamp,
        PlatformLogField.Log,
      ]);
    });

    it('always keeps the message column, whatever the URL says', () => {
      const { result } = renderFilters('/?fields=Timestamp,Pod');

      expect(result.current.filters.selectedFields).toContain(
        PlatformLogField.Log,
      );
    });
  });

  describe('updating', () => {
    it('writes filter lists back as comma-separated params', () => {
      const { result } = renderFilters('/');

      act(() => {
        result.current.updateFilters({ namespaces: ['a', 'b'] });
      });

      expect(result.current.filters.namespaces).toEqual(['a', 'b']);
    });

    it('drops a filter from the URL when it is emptied', () => {
      const { result } = renderFilters('/?ns=a,b');

      act(() => {
        result.current.updateFilters({ namespaces: [] });
      });

      expect(result.current.filters.namespaces).toEqual([]);
    });

    it('persists a cleared label selector rather than falling back to the default', () => {
      const { result } = renderFilters('/');

      act(() => {
        result.current.updateFilters({ labels: '' });
      });

      expect(result.current.filters.labels).toBe('');
    });

    it('elides the log level param when every level is selected', () => {
      const { result } = renderFilters('/?logLevel=ERROR');

      act(() => {
        result.current.updateFilters({ logLevel: [...PLATFORM_LOG_LEVELS] });
      });

      expect(result.current.filters.logLevel).toEqual(PLATFORM_LOG_LEVELS);
    });

    it('round-trips live tail', () => {
      const { result } = renderFilters('/');
      expect(result.current.filters.isLive).toBe(false);

      act(() => {
        result.current.updateFilters({ isLive: true });
      });

      expect(result.current.filters.isLive).toBe(true);
    });

    // A custom range has a fixed upper bound, so re-running it returns the same rows
    // forever. Leaving live=true in the URL would show a Live button that is on and
    // never updates.
    it('stops tailing when the range becomes custom', () => {
      const { result } = renderFilters('/?live=true');
      expect(result.current.filters.isLive).toBe(true);

      act(() => {
        result.current.updateFilters({
          timeRange: 'custom',
          customStartTime: '2026-09-01T00:00:00.000Z',
          customEndTime: '2026-09-01T01:00:00.000Z',
        });
      });

      expect(result.current.filters.isLive).toBe(false);
    });

    // Switching to custom clears the flag rather than parking it: something that polls
    // the server every 5s should not silently restart when the range changes back.
    it('does not resume tailing when the range goes custom and back', () => {
      const { result } = renderFilters('/?live=true');

      act(() => {
        result.current.updateFilters({
          timeRange: 'custom',
          customStartTime: '2026-09-01T00:00:00.000Z',
          customEndTime: '2026-09-01T01:00:00.000Z',
        });
      });
      act(() => {
        result.current.updateFilters({ timeRange: '10m' });
      });

      expect(result.current.filters.timeRange).toBe('10m');
      expect(result.current.filters.isLive).toBe(false);
    });

    it('ignores live on a custom range even if the URL asks for it', () => {
      const { result } = renderFilters(
        '/?live=true&timeRange=custom&from=2026-09-01T00:00:00.000Z&to=2026-09-01T01:00:00.000Z',
      );

      expect(result.current.filters.timeRange).toBe('custom');
      expect(result.current.filters.isLive).toBe(false);
    });

    it('round-trips the selected plane', () => {
      const { result } = renderFilters('/');

      act(() => {
        result.current.updateFilters({ observabilityPlane: 'default' });
      });

      expect(result.current.filters.observabilityPlane).toBe('default');
    });
  });
});
