import type { CostResourceProfile } from '../../types';

export type CostViewMode = 'table' | 'graph';

/**
 * The scope level is derived from how deep the breadcrumb selection goes:
 * - `namespace`: rows are projects
 * - `project`:   rows are components
 * - `component`: rows are environments (with right-sizing recommendations)
 */
export type CostScopeLevel = 'namespace' | 'project' | 'component';

export interface CostScope {
  namespace?: string;
  project?: string;
  component?: string;
}

/** A project (System) qualified by the namespace it belongs to. */
export interface CostProjectRef {
  namespace: string;
  name: string;
}

/** A component qualified by its namespace + project. */
export interface CostComponentRef {
  namespace: string;
  project: string;
  name: string;
}

/**
 * The multi-select scope driving the page: independent Namespace / Project /
 * Component selections. The deepest populated tier decides what the table shows;
 * costs are aggregated across every selected item at that tier.
 */
export interface CostScopeSelection {
  namespaces: string[];
  projects: CostProjectRef[];
  components: CostComponentRef[];
}

/** The four resource quantity strings (K8s notation) for a workload. */
export type CostResourceQuantities = Pick<
  CostResourceProfile,
  'cpuRequest' | 'cpuLimit' | 'memoryRequest' | 'memoryLimit'
>;

/** Recommendation ("Cost After Optimizing") shown only at the component level. */
export interface CostRowRecommendation extends CostResourceProfile {
  total: number;
  /** Current (pre-optimization) resource values, for the confirm-diff dialog. */
  current?: CostResourceQuantities;
}

export interface CostRow {
  /** Dimension value: project / component / environment name. */
  key: string;
  label: string;
  cpuCost: number;
  memoryCost: number;
  total: number;
  /** Cost-weighted average efficiency in 0..1. */
  efficiency: number;
  /** Reclaimable spend (current total − recommended total), clamped ≥ 0. */
  saving?: number;
  /** Percent change vs the previous equal-length window (null if unknown). */
  deltaPct: number | null;
  recommendation?: CostRowRecommendation;
  /**
   * True when the environment's ReleaseBinding was updated after the selected
   * window's start, so recommendations derived from that window's usage would be
   * based on the pre-change spec and are therefore withheld.
   */
  recommendationStale?: boolean;
  /** ISO spec update time of the binding, shown in the withheld-recommendation notice. */
  recommendationStaleSince?: string;
}

export interface CostSummary {
  totalCost: number;
  deltaPct: number | null;
  /** Linear extrapolation of the window's spend to the current calendar month. */
  forecastThisMonth: number;
  efficiency: number;
  /** Aggregate reclaimable spend across the scope. */
  totalSaving: number;
}

/** One stacked-bar time bucket: `{ timestamp, [dimensionValue]: cost }`. */
export type CostSeriesPoint = {
  timestamp: string;
} & Record<string, number | string>;

/**
 * One point on the forecast-divergence chart. `actual` covers the measured
 * window; `atCurrent`/`ifApplied` are the two projections.
 */
export interface ForecastPoint {
  timestamp: string;
  actual?: number;
  atCurrent?: number;
  ifApplied?: number;
}

export interface ForecastData {
  points: ForecastPoint[];
  /** Projected month-end spend at the current rate. */
  atCurrentTotal: number;
  /** Projected month-end spend with recommendations applied. */
  ifAppliedTotal: number;
  /** Gap between the projections (the cost of doing nothing). */
  leftOnTable: number;
}

export interface CostInsightsData {
  level: CostScopeLevel;
  summary: CostSummary;
  rows: CostRow[];
  series: CostSeriesPoint[];
  /** Distinct dimension values used as stack keys in the graph. */
  seriesKeys: string[];
  /** Forecast-divergence chart data; null when the window can't be projected. */
  forecast: ForecastData | null;
}
