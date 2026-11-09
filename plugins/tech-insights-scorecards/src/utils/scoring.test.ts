import type { MaturityCheckResult } from '@backstage-community/plugin-tech-insights-maturity-common';
import {
  compareCheckResults,
  progressByCategory,
  progressByTier,
  progressOf,
  rankOf,
} from './scoring';

function result(
  rank: number,
  passed: boolean,
  category = 'Security',
): MaturityCheckResult {
  return {
    result: passed,
    facts: {},
    check: {
      id: `${category}-${rank}-${passed}`,
      type: 'json-rules-engine',
      name: 'check',
      description: '',
      factIds: [],
      metadata: { rank, category, solution: '', exp: 0 },
    },
  } as MaturityCheckResult;
}

describe('rankOf', () => {
  it('is the highest tier when every check passes', () => {
    expect(rankOf([result(1, true), result(3, true)])).toBe(3);
  });

  it('stops just below the lowest failing tier', () => {
    expect(rankOf([result(1, true), result(2, false), result(3, true)])).toBe(
      1,
    );
    expect(rankOf([result(1, false), result(3, true)])).toBe(0);
  });

  it('is Stone with no checks', () => {
    expect(rankOf([])).toBe(0);
  });

  it('stays at Stone when a Stone check fails', () => {
    expect(rankOf([result(0, false), result(2, true)])).toBe(0);
  });
});

describe('progress', () => {
  it('counts passing checks overall and per category', () => {
    const checks = [
      result(1, true, 'Security'),
      result(2, false, 'Security'),
      result(1, true, 'Documentation'),
    ];
    expect(progressOf(checks)).toEqual({
      passedChecks: 2,
      totalChecks: 3,
      percentage: 67,
    });
    expect(progressByCategory(checks)).toEqual([
      {
        category: 'Documentation',
        passedChecks: 1,
        totalChecks: 1,
        percentage: 100,
      },
      { category: 'Security', passedChecks: 1, totalChecks: 2, percentage: 50 },
    ]);
  });

  it('counts passing checks per tier, lowest tier first, with every tier', () => {
    expect(
      progressByTier([result(3, false), result(1, true), result(1, false)]),
    ).toEqual([
      { rank: 1, passedChecks: 1, totalChecks: 2 },
      { rank: 2, passedChecks: 0, totalChecks: 0 },
      { rank: 3, passedChecks: 0, totalChecks: 1 },
    ]);
  });
});

describe('compareCheckResults', () => {
  it('puts lower tiers first, then failing checks', () => {
    const sorted = [
      result(2, true),
      result(1, true),
      result(2, false),
      result(1, false),
    ].sort(compareCheckResults);
    expect(sorted.map(c => [c.check.metadata.rank, c.result])).toEqual([
      [1, false],
      [1, true],
      [2, false],
      [2, true],
    ]);
  });
});
