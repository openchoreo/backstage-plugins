import { renderHook } from '@testing-library/react';
import { useChangeDetection } from './useChangeDetection';

describe('useChangeDetection', () => {
  it('returns empty changes for identical data', () => {
    const data = { name: 'test', count: 1 };
    const { result } = renderHook(() => useChangeDetection(data, data));

    expect(result.current.changes).toEqual([]);
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.changeCount).toBe(0);
    expect(result.current.stats).toEqual({
      total: 0,
      new: 0,
      modified: 0,
      removed: 0,
    });
  });

  it('returns empty changes for deeply equal objects', () => {
    const initial = { a: 1, nested: { b: 2 } };
    const current = { a: 1, nested: { b: 2 } };
    const { result } = renderHook(() => useChangeDetection(initial, current));

    expect(result.current.hasChanges).toBe(false);
    expect(result.current.changeCount).toBe(0);
  });

  it('detects modified fields', () => {
    const initial = { name: 'old', count: 1 };
    const current = { name: 'new', count: 1 };
    const { result } = renderHook(() => useChangeDetection(initial, current));

    expect(result.current.hasChanges).toBe(true);
    expect(result.current.changeCount).toBe(1);
    expect(result.current.changes).toEqual([
      { path: 'name', type: 'modified', oldValue: 'old', newValue: 'new' },
    ]);
    expect(result.current.stats.modified).toBe(1);
  });

  it('detects new fields', () => {
    const initial = { a: 1 };
    const current = { a: 1, b: 2 };
    const { result } = renderHook(() => useChangeDetection(initial, current));

    expect(result.current.hasChanges).toBe(true);
    expect(result.current.changes).toEqual(
      expect.arrayContaining([{ path: 'b', type: 'new', newValue: 2 }]),
    );
    expect(result.current.stats.new).toBe(1);
  });

  it('detects removed fields', () => {
    const initial = { a: 1, b: 2 };
    const current = { a: 1 };
    const { result } = renderHook(() => useChangeDetection(initial, current));

    expect(result.current.hasChanges).toBe(true);
    expect(result.current.changes).toEqual(
      expect.arrayContaining([{ path: 'b', type: 'removed', oldValue: 2 }]),
    );
    expect(result.current.stats.removed).toBe(1);
  });

  it('returns correct hasChanges, changeCount, and stats for mixed changes', () => {
    const initial: Record<string, number> = { a: 1, b: 2 };
    const current: Record<string, number> = { a: 10, c: 3 };
    const { result } = renderHook(() => useChangeDetection(initial, current));

    expect(result.current.hasChanges).toBe(true);
    expect(result.current.changeCount).toBe(3);
    expect(result.current.stats).toEqual({
      total: 3,
      new: 1,
      modified: 1,
      removed: 1,
    });
  });

  it('memoizes result when inputs are the same reference', () => {
    const initial = { a: 1 };
    const current = { a: 2 };
    const { result, rerender } = renderHook(() =>
      useChangeDetection(initial, current),
    );

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
  });

  it('recalculates when inputs change', () => {
    const initial = { a: 1 };
    let current = { a: 2 };

    const { result, rerender } = renderHook(
      ({ init, cur }) => useChangeDetection(init, cur),
      { initialProps: { init: initial, cur: current } },
    );

    const firstResult = result.current;
    expect(firstResult.changeCount).toBe(1);

    current = { a: 3 };
    rerender({ init: initial, cur: current });

    expect(result.current.changeCount).toBe(1);
    expect(result.current.changes[0].newValue).toBe(3);
  });
});
