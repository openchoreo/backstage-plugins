import { renderHook, act } from '@testing-library/react';
import { useUrlSyncedTab } from './useUrlSyncedTab';

describe('useUrlSyncedTab', () => {
  it('uses initialTab when provided', () => {
    const { result } = renderHook(() =>
      useUrlSyncedTab({
        initialTab: 'settings',
        defaultTab: 'overview',
      }),
    );

    expect(result.current[0]).toBe('settings');
  });

  it('falls back to defaultTab when initialTab is undefined', () => {
    const { result } = renderHook(() =>
      useUrlSyncedTab({
        initialTab: undefined,
        defaultTab: 'overview',
      }),
    );

    expect(result.current[0]).toBe('overview');
  });

  it('setActiveTab updates state and calls onTabChange', () => {
    const onTabChange = jest.fn();
    const { result } = renderHook(() =>
      useUrlSyncedTab<string>({
        initialTab: 'overview',
        defaultTab: 'overview',
        onTabChange,
      }),
    );

    act(() => {
      result.current[1]('settings');
    });

    expect(result.current[0]).toBe('settings');
    expect(onTabChange).toHaveBeenCalledWith('settings', undefined);
  });

  it('setActiveTab passes replace flag to onTabChange', () => {
    const onTabChange = jest.fn();
    const { result } = renderHook(() =>
      useUrlSyncedTab<string>({
        initialTab: 'overview',
        defaultTab: 'overview',
        onTabChange,
      }),
    );

    act(() => {
      result.current[1]('logs', true);
    });

    expect(onTabChange).toHaveBeenCalledWith('logs', true);
  });

  it('syncs when initialTab changes externally after mount', () => {
    const { result, rerender } = renderHook(
      ({ initialTab }) =>
        useUrlSyncedTab({
          initialTab,
          defaultTab: 'overview',
        }),
      { initialProps: { initialTab: 'overview' as string | undefined } },
    );

    expect(result.current[0]).toBe('overview');

    rerender({ initialTab: 'settings' });

    expect(result.current[0]).toBe('settings');
  });

  it('skips initial mount sync (does not re-set state from initialTab on first render)', () => {
    const onTabChange = jest.fn();
    renderHook(() =>
      useUrlSyncedTab({
        initialTab: 'overview',
        defaultTab: 'overview',
        onTabChange,
      }),
    );

    // onTabChange should not be called during mount - only via setActiveTab
    expect(onTabChange).not.toHaveBeenCalled();
  });

  it('does not update state when initialTab changes to undefined', () => {
    const { result, rerender } = renderHook(
      ({ initialTab }) =>
        useUrlSyncedTab({
          initialTab,
          defaultTab: 'overview',
        }),
      { initialProps: { initialTab: 'settings' as string | undefined } },
    );

    expect(result.current[0]).toBe('settings');

    rerender({ initialTab: undefined });

    // Should keep current tab since initialTab is undefined
    expect(result.current[0]).toBe('settings');
  });

  it('does not update state when initialTab matches current activeTab', () => {
    const { result, rerender } = renderHook(
      ({ initialTab }) =>
        useUrlSyncedTab({
          initialTab,
          defaultTab: 'overview',
        }),
      { initialProps: { initialTab: 'settings' as string | undefined } },
    );

    // Force a re-render with the same initialTab
    rerender({ initialTab: 'settings' });

    // State should remain unchanged
    expect(result.current[0]).toBe('settings');
  });
});
