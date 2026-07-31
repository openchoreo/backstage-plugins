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

/** Recommendation ("Cost After Optimizing") shown only at the component level. */
export interface CostRowRecommendation extends CostResourceProfile {
  total: number;
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
  /** Percent change vs the previous equal-length window (null if unknown). */
  deltaPct: number | null;
  recommendation?: CostRowRecommendation;
}

export interface CostSummary {
  totalCost: number;
  deltaPct: number | null;
  /** Linear extrapolation of the window's spend to the current calendar month. */
  forecastThisMonth: number;
  efficiency: number;
}

/** One stacked-bar time bucket: `{ timestamp, [dimensionValue]: cost }`. */
export type CostSeriesPoint = {
  timestamp: string;
} & Record<string, number | string>;

export interface CostInsightsData {
  level: CostScopeLevel;
  summary: CostSummary;
  rows: CostRow[];
  series: CostSeriesPoint[];
  /** Distinct dimension values used as stack keys in the graph. */
  seriesKeys: string[];
}
