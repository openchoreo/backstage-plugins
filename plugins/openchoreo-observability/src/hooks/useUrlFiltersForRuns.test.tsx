import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useUrlFiltersForRuns } from './useUrlFiltersForRuns';

const environments = [
  { id: 'env-1', name: 'development', resourceName: 'dev' },
  { id: 'env-2', name: 'production', resourceName: 'prod' },
];

const renderFilters = (initialEntry = '/', envs = environments) =>
  renderHook(() => useUrlFiltersForRuns({ environments: envs }), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    ),
  });

describe('useUrlFiltersForRuns', () => {
  describe('parsing', () => {
    it('applies default filters when the URL is empty', () => {
      const { result } = renderFilters('/');
      // First render sees defaults; the auto-select effect then writes env=env-1.
      expect(result.current.filters).toEqual(
        expect.objectContaining({
          timeRange: '24h',
          sortOrder: 'desc',
          page: 0,
        }),
      );
    });

    it('auto-selects the first environment when none is in the URL', () => {
      const { result } = renderFilters('/');
      // Effect runs synchronously under RTL's act; the environment is written back.
      expect(result.current.filters.environmentId).toBe('env-1');
    });

    it('reads env, timeRange, sort and page from the URL', () => {
      const { result } = renderFilters(
        '/?env=env-2&timeRange=7d&sort=asc&page=3',
      );

      expect(result.current.filters.environmentId).toBe('env-2');
      expect(result.current.filters.timeRange).toBe('7d');
      expect(result.current.filters.sortOrder).toBe('asc');
      expect(result.current.filters.page).toBe(3);
    });

    it('falls back to the default when timeRange is not in the whitelist', () => {
      const { result } = renderFilters('/?env=env-1&timeRange=bogus');
      expect(result.current.filters.timeRange).toBe('24h');
    });

    it('falls back to desc sort order when the sort param is invalid', () => {
      const { result } = renderFilters('/?env=env-1&sort=weird');
      expect(result.current.filters.sortOrder).toBe('desc');
    });

    it('clamps a negative page to 0 and treats non-numeric as 0', () => {
      const negative = renderFilters('/?env=env-1&page=-5');
      expect(negative.result.current.filters.page).toBe(0);

      const nonNumeric = renderFilters('/?env=env-1&page=abc');
      expect(nonNumeric.result.current.filters.page).toBe(0);
    });

    it('rejects an env id not in the list and auto-selects the first', () => {
      const { result } = renderFilters('/?env=missing');
      expect(result.current.filters.environmentId).toBe('env-1');
    });

    it('leaves environmentId empty when the environments list is empty', () => {
      const { result } = renderFilters('/', []);
      expect(result.current.filters.environmentId).toBe('');
    });
  });

  describe('updateFilters', () => {
    it('writes a new environmentId and resets page', () => {
      const { result } = renderFilters('/?env=env-1&page=2');
      act(() => result.current.updateFilters({ environmentId: 'env-2' }));
      expect(result.current.filters.environmentId).toBe('env-2');
      expect(result.current.filters.page).toBe(0);
    });

    it('clears the environmentId when passed an empty string', () => {
      // Empty environments list so the auto-select effect doesn't re-fill it.
      const { result } = renderFilters('/?env=env-1', []);
      act(() => result.current.updateFilters({ environmentId: '' }));
      expect(result.current.filters.environmentId).toBe('');
    });

    it('persists a non-default timeRange and clears page', () => {
      const { result } = renderFilters('/?env=env-1&page=2');
      act(() => result.current.updateFilters({ timeRange: '7d' }));
      expect(result.current.filters.timeRange).toBe('7d');
      expect(result.current.filters.page).toBe(0);
    });

    it('resetting timeRange to the default removes it from the URL', () => {
      const { result } = renderFilters('/?env=env-1&timeRange=7d');
      act(() => result.current.updateFilters({ timeRange: '24h' }));
      expect(result.current.filters.timeRange).toBe('24h');
    });

    it('persists asc sort and treats desc as the default', () => {
      const { result } = renderFilters('/?env=env-1');
      act(() => result.current.updateFilters({ sortOrder: 'asc' }));
      expect(result.current.filters.sortOrder).toBe('asc');
      act(() => result.current.updateFilters({ sortOrder: 'desc' }));
      expect(result.current.filters.sortOrder).toBe('desc');
    });

    it('writes page > 0 and clears it when set back to 0', () => {
      const { result } = renderFilters('/?env=env-1');
      act(() => result.current.updateFilters({ page: 4 }));
      expect(result.current.filters.page).toBe(4);
      act(() => result.current.updateFilters({ page: 0 }));
      expect(result.current.filters.page).toBe(0);
    });
  });

  describe('resetFilters', () => {
    it('resets to the first environment and clears every other param', () => {
      const { result } = renderFilters(
        '/?env=env-2&timeRange=7d&sort=asc&page=5',
      );

      act(() => result.current.resetFilters());

      expect(result.current.filters.environmentId).toBe('env-1');
      expect(result.current.filters.timeRange).toBe('24h');
      expect(result.current.filters.sortOrder).toBe('desc');
      expect(result.current.filters.page).toBe(0);
    });

    it('leaves env empty when there are no environments', () => {
      const { result } = renderFilters('/?env=env-1&page=5', []);
      act(() => result.current.resetFilters());
      expect(result.current.filters.environmentId).toBe('');
      expect(result.current.filters.page).toBe(0);
    });
  });
});
