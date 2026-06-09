import { act, renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useUrlFiltersForRuntimeEvents } from './useUrlFiltersForRuntimeEvents';
import {
  EventEntryField,
  SELECTED_FIELDS,
} from '../components/RuntimeEvents/types';

jest.mock('./useAutoSelectFirstEnvironment', () => ({
  useAutoSelectFirstEnvironment: jest.fn(),
}));

const environments = [
  { name: 'development', displayName: 'Development' },
  { name: 'production', displayName: 'Production' },
] as any;

const renderFilters = (initialEntry = '/') =>
  renderHook(() => useUrlFiltersForRuntimeEvents({ environments }), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    ),
  });

describe('useUrlFiltersForRuntimeEvents', () => {
  describe('parsing', () => {
    it('applies defaults when the URL is empty', () => {
      const { result } = renderFilters('/');

      expect(result.current.filters).toEqual(
        expect.objectContaining({
          environment: '',
          timeRange: '10m',
          sortOrder: 'asc',
          isLive: false,
        }),
      );
      expect(result.current.filters.selectedFields).toEqual([
        EventEntryField.Timestamp,
        EventEntryField.Type,
        EventEntryField.Reason,
        EventEntryField.Object,
        EventEntryField.Message,
      ]);
    });

    it('resolves the environment from the env query param', () => {
      const { result } = renderFilters('/?env=production');
      expect(result.current.filters.environment).toBe('production');
    });

    it('ignores an env value not in the environments list', () => {
      const { result } = renderFilters('/?env=nope');
      expect(result.current.filters.environment).toBe('');
    });

    it('parses sort=desc and live=true', () => {
      const { result } = renderFilters('/?sort=desc&live=true');
      expect(result.current.filters.sortOrder).toBe('desc');
      expect(result.current.filters.isLive).toBe(true);
    });

    it('parses a field subset, forces Message in, and normalizes order', () => {
      const { result } = renderFilters('/?fields=Reason,Timestamp');
      expect(result.current.filters.selectedFields).toEqual([
        EventEntryField.Timestamp,
        EventEntryField.Reason,
        EventEntryField.Message,
      ]);
    });

    it('drops unknown field tokens', () => {
      const { result } = renderFilters('/?fields=Bogus,Type');
      expect(result.current.filters.selectedFields).toEqual([
        EventEntryField.Type,
        EventEntryField.Message,
      ]);
    });
  });

  describe('updateFilters', () => {
    it('writes a new environment to the URL', () => {
      const { result } = renderFilters('/?env=development');
      act(() => result.current.updateFilters({ environment: 'production' }));
      expect(result.current.filters.environment).toBe('production');
    });

    it('clearing the environment removes it', () => {
      const { result } = renderFilters('/?env=development');
      act(() => result.current.updateFilters({ environment: '' }));
      expect(result.current.filters.environment).toBe('');
    });

    it('persists sort=desc and treats asc as the default', () => {
      const { result } = renderFilters('/?env=development&sort=desc');
      act(() => result.current.updateFilters({ sortOrder: 'asc' }));
      expect(result.current.filters.sortOrder).toBe('asc');
      act(() => result.current.updateFilters({ sortOrder: 'desc' }));
      expect(result.current.filters.sortOrder).toBe('desc');
    });

    it('toggles live on and off', () => {
      const { result } = renderFilters('/?env=development');
      act(() => result.current.updateFilters({ isLive: true }));
      expect(result.current.filters.isLive).toBe(true);
      act(() => result.current.updateFilters({ isLive: false }));
      expect(result.current.filters.isLive).toBe(false);
    });

    it('returns to all fields when the full default set is selected', () => {
      const { result } = renderFilters('/?env=development&fields=Type');
      act(() =>
        result.current.updateFilters({ selectedFields: [...SELECTED_FIELDS] }),
      );
      expect(result.current.filters.selectedFields).toHaveLength(5);
    });

    it('stores a non-default subset and forces Message in', () => {
      const { result } = renderFilters('/?env=development');
      act(() =>
        result.current.updateFilters({
          selectedFields: [EventEntryField.Type],
        }),
      );
      expect(result.current.filters.selectedFields).toEqual([
        EventEntryField.Type,
        EventEntryField.Message,
      ]);
    });
  });

  describe('resetFilters', () => {
    it('resets to the first environment and clears other params', () => {
      const { result } = renderFilters(
        '/?env=production&sort=desc&live=true&fields=Type',
      );
      act(() => result.current.resetFilters());

      expect(result.current.filters.environment).toBe('development');
      expect(result.current.filters.sortOrder).toBe('asc');
      expect(result.current.filters.isLive).toBe(false);
      expect(result.current.filters.selectedFields).toHaveLength(5);
    });
  });
});
