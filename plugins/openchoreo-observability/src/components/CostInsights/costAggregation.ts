import type { CostItem, CostRecommendationItem } from '../../types';
import type {
  CostScope,
  CostScopeLevel,
  CostRow,
  CostSummary,
  CostSeriesPoint,
  CostInsightsData,
  ForecastData,
  ForecastPoint,
} from './types';

/** Derive the scope level from the breadcrumb selection depth. */
export function deriveLevel(scope: CostScope): CostScopeLevel {
  if (scope.component) return 'component';
  if (scope.project) return 'project';
  return 'namespace';
}

/** The field a cost item is grouped by at the given level. */
export function dimensionOf(item: CostItem, level: CostScopeLevel): string {
  switch (level) {
    case 'namespace':
      return item.project;
    case 'project':
      return item.component;
    case 'component':
    default:
      return item.environment;
  }
}

const itemTotal = (item: CostItem): number =>
  (item.cpuCost ?? 0) + (item.memoryCost ?? 0);

/**
 * Cost-weighted average efficiency across items. Efficiency of a bigger spend
 * counts more; returns 0 when there is no spend to weight by.
 */
function weightedEfficiency(items: CostItem[]): number {
  let weightSum = 0;
  let effSum = 0;
  for (const item of items) {
    const weight = itemTotal(item);
    weightSum += weight;
    effSum += (item.efficiency ?? 0) * weight;
  }
  return weightSum > 0 ? effSum / weightSum : 0;
}

/** Sum of cpu + memory cost across every item. */
export function totalCost(items: CostItem[]): number {
  return items.reduce((sum, item) => sum + itemTotal(item), 0);
}

/** Percent change from `previous` to `current`; null when previous is 0/unknown. */
export function percentChange(
  current: number,
  previous: number | undefined,
): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Milliseconds in the calendar month that contains `now`. */
export function monthDurationMs(now: Date): number {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return end.getTime() - start.getTime();
}

/**
 * Forecast the current calendar month's spend by extrapolating the window's
 * spend rate. `windowStart`/`windowEnd` bound the measured window.
 */
export function forecastThisMonth(
  total: number,
  windowStart: string,
  windowEnd: string,
  now: Date,
): number {
  const windowMs =
    new Date(windowEnd).getTime() - new Date(windowStart).getTime();
  if (!Number.isFinite(windowMs) || windowMs <= 0) return total;
  const ratePerMs = total / windowMs;
  return ratePerMs * monthDurationMs(now);
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

/** Cost totals keyed by dimension value (used for deltas and per-dim saving). */
function totalsByDimension(
  items: CostItem[],
  level: CostScopeLevel,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) {
    const dim = dimensionOf(item, level);
    totals.set(dim, (totals.get(dim) ?? 0) + itemTotal(item));
  }
  return totals;
}

/** The dimension value a recommendation is grouped by at the given level. */
function recDimensionOf(
  rec: CostRecommendationItem,
  level: CostScopeLevel,
): string {
  switch (level) {
    case 'namespace':
      return rec.project;
    case 'project':
      return rec.component;
    case 'component':
    default:
      return rec.environment;
  }
}

const recTotal = (rec: CostRecommendationItem): number =>
  (rec.recommendation.cpuCost ?? 0) + (rec.recommendation.memoryCost ?? 0);

/**
 * Recommended (post-optimization) totals keyed by dimension value. At the
 * component level, environments in `staleEnvs` are skipped (their recommendation
 * is withheld).
 */
function recommendedTotalsByDimension(
  recommendations: CostRecommendationItem[],
  level: CostScopeLevel,
  staleEnvs: Map<string, string>,
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const rec of recommendations) {
    if (level === 'component' && staleEnvs.has(rec.environment)) continue;
    const dim = recDimensionOf(rec, level);
    totals.set(dim, (totals.get(dim) ?? 0) + recTotal(rec));
  }
  return totals;
}

/**
 * Aggregate the flat, multi-environment cost items into one row per dimension
 * value. At the component level, attaches the right-sizing recommendation
 * ("Cost After Optimizing") keyed by environment.
 */
export function aggregateRows(
  currentItems: CostItem[],
  previousItems: CostItem[],
  level: CostScopeLevel,
  recommendations: CostRecommendationItem[] = [],
  staleRecommendationEnvs: Map<string, string> = new Map(),
): CostRow[] {
  const prevTotals = totalsByDimension(previousItems, level);
  const recTotals = recommendedTotalsByDimension(
    recommendations,
    level,
    staleRecommendationEnvs,
  );
  const grouped = groupBy(currentItems, item => dimensionOf(item, level));

  // Recommendations are only meaningful at the component level, where rows are
  // environments. Sum the recommended cost per environment.
  const recByEnv = new Map<string, CostRecommendationItem[]>();
  if (level === 'component') {
    for (const rec of recommendations) {
      const bucket = recByEnv.get(rec.environment);
      if (bucket) bucket.push(rec);
      else recByEnv.set(rec.environment, [rec]);
    }
  }

  const rows: CostRow[] = [];
  for (const [key, items] of grouped) {
    const cpuCost = items.reduce((s, i) => s + (i.cpuCost ?? 0), 0);
    const memoryCost = items.reduce((s, i) => s + (i.memoryCost ?? 0), 0);
    const total = cpuCost + memoryCost;

    const recommendationStale =
      level === 'component' && staleRecommendationEnvs.has(key);
    const recommendationStaleSince = recommendationStale
      ? staleRecommendationEnvs.get(key)
      : undefined;

    let recommendation: CostRow['recommendation'];
    if (level === 'component' && !recommendationStale) {
      const recs = recByEnv.get(key);
      if (recs && recs.length > 0) {
        const recCpu = recs.reduce(
          (s, r) => s + (r.recommendation.cpuCost ?? 0),
          0,
        );
        const recMem = recs.reduce(
          (s, r) => s + (r.recommendation.memoryCost ?? 0),
          0,
        );
        // Resource strings only make sense for a single component/env pair;
        // surface the first recommendation's request/limit values (and its
        // current values, for the confirm-diff dialog).
        const first = recs[0].recommendation;
        const firstCurrent = recs[0].current;
        recommendation = {
          cpuRequest: first.cpuRequest,
          cpuLimit: first.cpuLimit,
          memoryRequest: first.memoryRequest,
          memoryLimit: first.memoryLimit,
          cpuCost: recCpu,
          memoryCost: recMem,
          total: recCpu + recMem,
          current: {
            cpuRequest: firstCurrent.cpuRequest,
            cpuLimit: firstCurrent.cpuLimit,
            memoryRequest: firstCurrent.memoryRequest,
            memoryLimit: firstCurrent.memoryLimit,
          },
        };
      }
    }

    const recDimTotal = recTotals.get(key);
    const saving =
      recDimTotal !== undefined ? Math.max(0, total - recDimTotal) : undefined;

    rows.push({
      key,
      label: key,
      cpuCost,
      memoryCost,
      total,
      efficiency: weightedEfficiency(items),
      saving,
      deltaPct: percentChange(total, prevTotals.get(key)),
      recommendation,
      recommendationStale,
      recommendationStaleSince,
    });
  }

  return rows.sort((a, b) => b.total - a.total);
}

/** Overall summary cards (total + delta + forecast + efficiency + saving). */
export function computeSummary(
  currentItems: CostItem[],
  previousItems: CostItem[],
  windowStart: string,
  windowEnd: string,
  now: Date,
  recommendations: CostRecommendationItem[],
  level: CostScopeLevel,
  staleRecommendationEnvs: Map<string, string>,
): CostSummary {
  const total = totalCost(currentItems);
  const prevTotal = totalCost(previousItems);
  // Only dimensions with a (non-stale) recommendation contribute saving, each
  // clamped at its own cost so unrelated spend isn't counted as reclaimable.
  const currentTotals = totalsByDimension(currentItems, level);
  const recTotals = recommendedTotalsByDimension(
    recommendations,
    level,
    staleRecommendationEnvs,
  );
  let totalSaving = 0;
  for (const [dim, recDimTotal] of recTotals) {
    totalSaving += Math.max(0, (currentTotals.get(dim) ?? 0) - recDimTotal);
  }
  return {
    totalCost: total,
    deltaPct: percentChange(total, prevTotal || undefined),
    forecastThisMonth: forecastThisMonth(total, windowStart, windowEnd, now),
    efficiency: weightedEfficiency(currentItems),
    totalSaving,
  };
}

/**
 * Build stacked-bar series: one point per time bucket (item.startTime), with a
 * cost total for each dimension value in that bucket (summed across
 * environments). Returns the points ordered by time plus the distinct
 * dimension values used as stack keys.
 */
export function buildSeries(
  items: CostItem[],
  level: CostScopeLevel,
): { series: CostSeriesPoint[]; seriesKeys: string[] } {
  // Normalise to the parsed instant so equivalent timestamps in different
  // textual forms (across per-environment responses) collapse into one bucket.
  const bucketKey = (startTime: string): string => {
    const t = new Date(startTime).getTime();
    return Number.isNaN(t) ? startTime : new Date(t).toISOString();
  };
  const byBucket = groupBy(items, item => bucketKey(item.startTime));
  const seriesKeys = new Set<string>();

  const series: CostSeriesPoint[] = [...byBucket.entries()]
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([timestamp, bucketItems]) => {
      const point: CostSeriesPoint = { timestamp };
      for (const item of bucketItems) {
        const dim = dimensionOf(item, level);
        seriesKeys.add(dim);
        point[dim] = ((point[dim] as number) ?? 0) + itemTotal(item);
      }
      return point;
    });

  return {
    series: fillMissingBuckets(series),
    seriesKeys: [...seriesKeys].sort(),
  };
}

/**
 * The cost API can omit empty buckets, which then collapse together on the
 * chart and hide the gap. Infer the interval from the smallest gap between
 * buckets and insert empty points for every skipped interval.
 */
function fillMissingBuckets(series: CostSeriesPoint[]): CostSeriesPoint[] {
  if (series.length < 2) return series;

  const times = series.map(p => new Date(p.timestamp).getTime());
  if (times.some(t => Number.isNaN(t))) return series;

  let interval = Infinity;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap > 0 && gap < interval) interval = gap;
  }
  if (!Number.isFinite(interval) || interval <= 0) return series;

  const MAX_POINTS = 2000;

  const filled: CostSeriesPoint[] = [series[0]];
  for (let i = 1; i < series.length; i++) {
    const prev = times[i - 1];
    const curr = times[i];
    const steps = Math.round((curr - prev) / interval);
    for (let s = 1; s < steps && filled.length < MAX_POINTS; s++) {
      filled.push({
        timestamp: new Date(prev + s * interval).toISOString(),
      });
    }
    filled.push(series[i]);
  }
  return filled;
}

/**
 * Forecast divergence: "at current rate" projects the window rate across the
 * whole month; "if applied" forks at the window end and reduces the rate only
 * going forward. Independent of chart granularity.
 */
export function buildForecast(params: {
  totalActual: number;
  totalSaving: number;
  windowStart: string;
  windowEnd: string;
  now: Date;
}): ForecastData | null {
  const { totalActual, totalSaving, windowStart, windowEnd, now } = params;
  const startMs = new Date(windowStart).getTime();
  const endMs = new Date(windowEnd).getTime();
  const windowMs = endMs - startMs;
  if (!Number.isFinite(windowMs) || windowMs <= 0) return null;

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthMs = monthEnd.getTime() - monthStart.getTime();
  const remainingMs = monthEnd.getTime() - endMs;
  if (!(remainingMs > 0)) return null;

  const rate = totalActual / windowMs;
  const savingFraction = totalActual > 0 ? totalSaving / totalActual : 0;
  const atCurrentTotal = rate * monthMs;

  // Current-month spend so far at the window rate. Deriving it from elapsed
  // month-time (rather than totalActual) excludes any prior-month spend when the
  // window crosses a month boundary.
  const elapsedThisMonthMs = Math.max(0, endMs - monthStart.getTime());
  const forkTotal = rate * elapsedThisMonthMs;
  const ifAppliedTotal = forkTotal + rate * (1 - savingFraction) * remainingMs;

  // One actual-cost line from the month start to now, drawn at the window rate
  // so its shape is independent of the chart's time granularity. It forks at
  // the current point (window end) into the two projections.
  const points: ForecastPoint[] = [
    { timestamp: monthStart.toISOString(), actual: 0 },
  ];
  points.push({
    timestamp: windowEnd,
    actual: forkTotal,
    atCurrent: forkTotal,
    ifApplied: forkTotal,
  });
  points.push({
    timestamp: monthEnd.toISOString(),
    atCurrent: atCurrentTotal,
    ifApplied: ifAppliedTotal,
  });

  points.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return {
    points,
    atCurrentTotal,
    ifAppliedTotal,
    leftOnTable: Math.max(0, atCurrentTotal - ifAppliedTotal),
  };
}

/** Assemble everything the view needs from the raw multi-env responses. */
export function buildCostInsightsData(params: {
  level: CostScopeLevel;
  currentItems: CostItem[];
  /** Time-bucketed items for the graph's time-series; defaults to currentItems. */
  seriesItems?: CostItem[];
  previousItems: CostItem[];
  recommendations?: CostRecommendationItem[];
  /** Withheld-recommendation envs mapped to the binding's spec update time. */
  staleRecommendationEnvs?: Map<string, string>;
  windowStart: string;
  windowEnd: string;
  now: Date;
}): CostInsightsData {
  const {
    level,
    currentItems,
    seriesItems,
    previousItems,
    recommendations = [],
    staleRecommendationEnvs = new Map<string, string>(),
    windowStart,
    windowEnd,
    now,
  } = params;

  const { series, seriesKeys } = buildSeries(
    seriesItems ?? currentItems,
    level,
  );
  const summary = computeSummary(
    currentItems,
    previousItems,
    windowStart,
    windowEnd,
    now,
    recommendations,
    level,
    staleRecommendationEnvs,
  );
  return {
    level,
    summary,
    rows: aggregateRows(
      currentItems,
      previousItems,
      level,
      recommendations,
      staleRecommendationEnvs,
    ),
    series,
    seriesKeys,
    forecast: buildForecast({
      totalActual: summary.totalCost,
      totalSaving: summary.totalSaving,
      windowStart,
      windowEnd,
      now,
    }),
  };
}
