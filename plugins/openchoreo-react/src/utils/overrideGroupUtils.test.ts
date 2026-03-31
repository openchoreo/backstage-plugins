import type { EnvVarWithStatus } from './envVarUtils';
import {
  groupByStatus,
  getStatusCounts,
  hasAnyItems,
  getTotalCount,
} from './overrideGroupUtils';

function makeItem(
  status: 'inherited' | 'overridden' | 'new',
): EnvVarWithStatus {
  return { envVar: { key: `key-${status}` }, status };
}

describe('groupByStatus', () => {
  it('returns empty groups for empty array', () => {
    const result = groupByStatus([]);
    expect(result).toEqual({ overridden: [], new: [], inherited: [] });
  });

  it('groups items by status', () => {
    const items = [
      makeItem('inherited'),
      makeItem('overridden'),
      makeItem('new'),
      makeItem('inherited'),
    ];
    const result = groupByStatus(items);

    expect(result.inherited).toHaveLength(2);
    expect(result.overridden).toHaveLength(1);
    expect(result.new).toHaveLength(1);
  });

  it('handles all same status', () => {
    const items = [makeItem('new'), makeItem('new')];
    const result = groupByStatus(items);

    expect(result.new).toHaveLength(2);
    expect(result.inherited).toHaveLength(0);
    expect(result.overridden).toHaveLength(0);
  });
});

describe('getStatusCounts', () => {
  it('returns all zeros for empty array', () => {
    expect(getStatusCounts([])).toEqual({
      overridden: 0,
      new: 0,
      inherited: 0,
    });
  });

  it('counts each status correctly', () => {
    const items = [
      makeItem('inherited'),
      makeItem('overridden'),
      makeItem('new'),
      makeItem('new'),
    ];
    expect(getStatusCounts(items)).toEqual({
      inherited: 1,
      overridden: 1,
      new: 2,
    });
  });
});

describe('hasAnyItems', () => {
  it('returns false when all zeros', () => {
    expect(hasAnyItems({ overridden: 0, new: 0, inherited: 0 })).toBe(false);
  });

  it('returns true when any category has items', () => {
    expect(hasAnyItems({ overridden: 0, new: 1, inherited: 0 })).toBe(true);
    expect(hasAnyItems({ overridden: 1, new: 0, inherited: 0 })).toBe(true);
    expect(hasAnyItems({ overridden: 0, new: 0, inherited: 3 })).toBe(true);
  });
});

describe('getTotalCount', () => {
  it('sums all categories', () => {
    expect(getTotalCount({ overridden: 2, new: 3, inherited: 5 })).toBe(10);
  });

  it('returns 0 for all zeros', () => {
    expect(getTotalCount({ overridden: 0, new: 0, inherited: 0 })).toBe(0);
  });
});
