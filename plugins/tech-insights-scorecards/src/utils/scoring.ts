import {
  Rank,
  type MaturityCheckResult,
} from '@backstage-community/plugin-tech-insights-maturity-common';

export interface CheckProgress {
  passedChecks: number;
  totalChecks: number;
  percentage: number;
}

export function progressOf(checks: MaturityCheckResult[]): CheckProgress {
  const passedChecks = checks.filter(c => c.result).length;
  const totalChecks = checks.length;
  return {
    passedChecks,
    totalChecks,
    percentage:
      totalChecks === 0 ? 0 : Math.round((passedChecks / totalChecks) * 100),
  };
}

/**
 * The tier a set of check results reaches, computed the way the maturity
 * plugin's `ScoringDataFormatter` does: the highest tier any check carries,
 * lowered to just below the lowest tier with a failing check. That formatter
 * isn't exported, and combining several entities' results needs it. Unlike
 * the formatter, a failing Stone check leaves the entity at Stone rather than
 * at -1, which no tier is, and a check without a tier counts as Stone, as it
 * does everywhere else here.
 */
export function rankOf(checks: MaturityCheckResult[]): Rank {
  const rankOfCheck = (c: MaturityCheckResult): Rank =>
    c.check.metadata?.rank ?? Rank.Stone;
  const maxRank = checks.reduce<Rank>(
    (max, c) => Math.max(max, rankOfCheck(c)),
    Rank.Stone,
  );
  const rank = checks.reduce<Rank>(
    (lowest, c) =>
      !c.result && rankOfCheck(c) <= lowest ? rankOfCheck(c) - 1 : lowest,
    maxRank,
  );
  return Math.max(rank, Rank.Stone);
}

export interface TierProgress {
  rank: Rank;
  passedChecks: number;
  totalChecks: number;
}

/**
 * Checks passing per tier, lowest tier first. Bronze, Silver and Gold are
 * always included, at 0/0 when no check carries them, so tiers line up
 * from one entity to the next.
 */
export function progressByTier(checks: MaturityCheckResult[]): TierProgress[] {
  const tiers = new Map<Rank, TierProgress>(
    [Rank.Bronze, Rank.Silver, Rank.Gold].map(rank => [
      rank,
      { rank, passedChecks: 0, totalChecks: 0 },
    ]),
  );
  checks.forEach(c => {
    const rank: Rank = c.check.metadata?.rank ?? Rank.Stone;
    if (!tiers.has(rank))
      tiers.set(rank, { rank, passedChecks: 0, totalChecks: 0 });
    const tier = tiers.get(rank)!;
    tier.totalChecks += 1;
    if (c.result) tier.passedChecks += 1;
  });
  return Array.from(tiers.values()).sort((a, b) => a.rank - b.rank);
}

/** Lowest tier first, then failing before passing, then by name. */
export function compareCheckResults(
  a: MaturityCheckResult,
  b: MaturityCheckResult,
): number {
  return (
    (a.check.metadata?.rank ?? Rank.Stone) -
      (b.check.metadata?.rank ?? Rank.Stone) ||
    Number(a.result) - Number(b.result) ||
    a.check.name.localeCompare(b.check.name)
  );
}

export interface CategoryProgress extends CheckProgress {
  category: string;
}

export const UNCATEGORIZED = 'Uncategorized';

export function progressByCategory(
  checks: MaturityCheckResult[],
): CategoryProgress[] {
  const groups = new Map<string, MaturityCheckResult[]>();
  checks.forEach(c => {
    const category = c.check.metadata?.category || UNCATEGORIZED;
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(c);
  });
  return Array.from(groups.entries())
    .map(([category, group]) => ({ category, ...progressOf(group) }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
