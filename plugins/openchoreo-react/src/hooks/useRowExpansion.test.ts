import { act, renderHook } from '@testing-library/react';
import { useRowExpansion } from './useRowExpansion';

describe('useRowExpansion', () => {
  it('starts with no rows expanded', () => {
    const { result } = renderHook(() => useRowExpansion());
    expect(result.current.expanded.has('a')).toBe(false);
    expect(result.current.expanded.has('anything')).toBe(false);
  });

  it('toggles a row to expanded and back', () => {
    const { result } = renderHook(() => useRowExpansion());

    act(() => result.current.toggle('a'));
    expect(result.current.expanded.has('a')).toBe(true);

    act(() => result.current.toggle('a'));
    expect(result.current.expanded.has('a')).toBe(false);
  });

  it('tracks multiple rows independently', () => {
    const { result } = renderHook(() => useRowExpansion());

    act(() => {
      result.current.toggle('a');
      result.current.toggle('b');
    });

    expect(result.current.expanded.has('a')).toBe(true);
    expect(result.current.expanded.has('b')).toBe(true);
    expect(result.current.expanded.has('c')).toBe(false);
  });

  it('reset collapses every expanded row', () => {
    const { result } = renderHook(() => useRowExpansion());

    act(() => {
      result.current.toggle('a');
      result.current.toggle('b');
    });
    expect(result.current.expanded.has('a')).toBe(true);

    act(() => result.current.reset());

    expect(result.current.expanded.has('a')).toBe(false);
    expect(result.current.expanded.has('b')).toBe(false);
  });

  it('keeps Set identity stable across renders that do not toggle', () => {
    // Regression guard: putting `expanded` in a useEffect dep must not re-fire
    // the effect on every parent re-render.
    const { result, rerender } = renderHook(() => useRowExpansion());
    const first = result.current.expanded;
    rerender();
    expect(result.current.expanded).toBe(first);
  });
});
