import {
  formatChangeValue,
  deepCompareObjects,
  getChangeStats,
} from './changeDetection';

describe('formatChangeValue', () => {
  it('handles null and undefined', () => {
    expect(formatChangeValue(null)).toBe('null');
    expect(formatChangeValue(undefined)).toBe('undefined');
  });

  it('formats strings with quoting by default', () => {
    expect(formatChangeValue('hello')).toBe('"hello"');
  });

  it('truncates long strings at maxLength', () => {
    const long = 'a'.repeat(150);
    const result = formatChangeValue(long);
    expect(result).toBe(`"${'a'.repeat(100)}..."`);
  });

  it('respects custom maxLength', () => {
    expect(formatChangeValue('abcdef', { maxLength: 3 })).toBe('"abc..."');
  });

  it('respects quoteStrings: false', () => {
    expect(formatChangeValue('hello', { quoteStrings: false })).toBe('hello');
  });

  it('formats numbers and booleans', () => {
    expect(formatChangeValue(42)).toBe('42');
    expect(formatChangeValue(0)).toBe('0');
    expect(formatChangeValue(true)).toBe('true');
    expect(formatChangeValue(false)).toBe('false');
  });

  it('formats empty array', () => {
    expect(formatChangeValue([])).toBe('[]');
  });

  it('formats short arrays (≤3 items) with formatted items', () => {
    expect(formatChangeValue([1, 'a', true])).toBe('[1, "a", true]');
  });

  it('formats long arrays as count', () => {
    expect(formatChangeValue([1, 2, 3, 4])).toBe('[4 items]');
  });

  it('formats empty object', () => {
    expect(formatChangeValue({})).toBe('{}');
  });

  it('formats small objects (≤2 keys) with entries', () => {
    expect(formatChangeValue({ a: 1, b: 'x' })).toBe('{a: 1, b: "x"}');
  });

  it('formats large objects as field count', () => {
    expect(formatChangeValue({ a: 1, b: 2, c: 3 })).toBe('{3 fields}');
  });

  it('formats functions and symbols', () => {
    expect(formatChangeValue(() => {})).toBe('[Function]');
    expect(formatChangeValue(Symbol('test'))).toBe('[Symbol]');
  });
});

describe('deepCompareObjects', () => {
  it('returns empty array for identical objects', () => {
    const obj = { a: 1, b: 'hello', c: { d: true } };
    expect(deepCompareObjects(obj, obj)).toEqual([]);
    expect(deepCompareObjects(obj, { ...obj, c: { d: true } })).toEqual([]);
  });

  it('detects added fields', () => {
    const changes = deepCompareObjects({}, { name: 'test' });
    expect(changes).toEqual([{ path: 'name', type: 'new', newValue: 'test' }]);
  });

  it('detects removed fields', () => {
    const changes = deepCompareObjects({ name: 'test' }, {});
    expect(changes).toEqual([
      { path: 'name', type: 'removed', oldValue: 'test' },
    ]);
  });

  it('detects modified primitives with old and new values', () => {
    const changes = deepCompareObjects({ count: 2 }, { count: 3 });
    expect(changes).toEqual([
      { path: 'count', type: 'modified', oldValue: 2, newValue: 3 },
    ]);
  });

  it('traverses nested objects with dot-notation paths', () => {
    const changes = deepCompareObjects(
      { config: { replicas: 2 } },
      { config: { replicas: 3, newField: 'v' } },
    );
    expect(changes).toHaveLength(2);
    expect(changes).toContainEqual({
      path: 'config.replicas',
      type: 'modified',
      oldValue: 2,
      newValue: 3,
    });
    expect(changes).toContainEqual({
      path: 'config.newField',
      type: 'new',
      newValue: 'v',
    });
  });

  it('handles array item additions', () => {
    const changes = deepCompareObjects({ items: [1] }, { items: [1, 2] });
    expect(changes).toContainEqual({
      path: 'items[1]',
      type: 'new',
      newValue: 2,
    });
  });

  it('handles array item removals', () => {
    const changes = deepCompareObjects({ items: [1, 2] }, { items: [1] });
    expect(changes).toContainEqual({
      path: 'items[1]',
      type: 'removed',
      oldValue: 2,
    });
  });

  it('handles array item modifications', () => {
    const changes = deepCompareObjects({ items: ['a'] }, { items: ['b'] });
    expect(changes).toContainEqual({
      path: 'items[0]',
      type: 'modified',
      oldValue: 'a',
      newValue: 'b',
    });
  });

  it('recurses into objects within arrays', () => {
    const changes = deepCompareObjects(
      { items: [{ name: 'a' }] },
      { items: [{ name: 'b' }] },
    );
    expect(changes).toContainEqual({
      path: 'items[0].name',
      type: 'modified',
      oldValue: 'a',
      newValue: 'b',
    });
  });

  it('handles mixed type changes', () => {
    const changes = deepCompareObjects({ val: 'text' }, { val: 42 });
    expect(changes).toContainEqual({
      path: 'val',
      type: 'modified',
      oldValue: 'text',
      newValue: 42,
    });
  });

  it('handles empty objects and arrays correctly', () => {
    expect(deepCompareObjects({}, {})).toEqual([]);
    expect(deepCompareObjects({ a: [] }, { a: [] })).toEqual([]);
  });

  it('expands new nested objects into individual changes', () => {
    const changes = deepCompareObjects({}, { nested: { a: 1, b: 2 } });
    expect(changes).toContainEqual({
      path: 'nested.a',
      type: 'new',
      newValue: 1,
    });
    expect(changes).toContainEqual({
      path: 'nested.b',
      type: 'new',
      newValue: 2,
    });
  });

  it('compares two non-object values at root', () => {
    const changes = deepCompareObjects('old', 'new');
    expect(changes).toEqual([
      { path: '.', type: 'modified', oldValue: 'old', newValue: 'new' },
    ]);
  });

  it('returns empty for identical non-object values', () => {
    expect(deepCompareObjects(42, 42)).toEqual([]);
  });
});

describe('getChangeStats', () => {
  it('returns all zeros for empty changes', () => {
    expect(getChangeStats([])).toEqual({
      total: 0,
      new: 0,
      modified: 0,
      removed: 0,
    });
  });

  it('counts each change type correctly', () => {
    const changes = [
      { path: 'a', type: 'new' as const, newValue: 1 },
      { path: 'b', type: 'modified' as const, oldValue: 1, newValue: 2 },
      { path: 'c', type: 'removed' as const, oldValue: 3 },
      { path: 'd', type: 'new' as const, newValue: 4 },
    ];
    expect(getChangeStats(changes)).toEqual({
      total: 4,
      new: 2,
      modified: 1,
      removed: 1,
    });
  });
});
