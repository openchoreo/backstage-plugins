import { useApi } from '@backstage/core-plugin-api';
import {
  useOpenChoreoQuery,
  calculateTimeRange,
} from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../../api/ObservabilityApi';
import type { CostItem, CostRecommendationItem } from '../../types';
import { buildCostInsightsData, deriveLevel } from './costAggregation';
import type { CostInsightsData, CostScope, CostViewMode } from './types';

export interface UseCostInsightsParams {
  scope: CostScope;
  /** Selected environment names (multi-select). */
  environments: string[];
  timeRange: string;
  customStartTime?: string;
  customEndTime?: string;
  view: CostViewMode;
  /** Cost-API granularity (e.g. `1h`, `1d`), only used in graph view. */
  granularity: string;
}

export interface UseCostInsightsResult {
  data: CostInsightsData | undefined;
  loading: boolean;
  isRefetching: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches cost (and, at the component level, right-sizing recommendations) for
 * every selected environment and aggregates them client-side — the observer
 * cost APIs are per-environment, so multi-environment totals are summed here.
 * A second query over the previous equal-length window drives the deltas.
 */
export function useCostInsights(
  params: UseCostInsightsParams,
): UseCostInsightsResult {
  const api = useApi(observabilityApiRef);
  const { scope, environments, timeRange, view, granularity } = params;
  const namespace = scope.namespace;
  const level = deriveLevel(scope);
  const sortedEnvs = [...environments].sort();

  const enabled = Boolean(namespace) && sortedEnvs.length > 0;

  const { data, loading, isRefetching, error, refetch } =
    useOpenChoreoQuery<CostInsightsData>(
      [
        'cost-insights',
        namespace ?? '',
        scope.project ?? '',
        scope.component ?? '',
        sortedEnvs.join(','),
        timeRange,
        params.customStartTime ?? '',
        params.customEndTime ?? '',
        view,
        granularity,
      ],
      async () => {
        const { startTime, endTime } = calculateTimeRange(timeRange, {
          startTime: params.customStartTime,
          endTime: params.customEndTime,
        });
        // Previous equal-length window, immediately before the current one.
        const windowMs =
          new Date(endTime).getTime() - new Date(startTime).getTime();
        const prevStart = new Date(
          new Date(startTime).getTime() - windowMs,
        ).toISOString();
        const prevEnd = startTime;

        const scopeOpts = {
          project: scope.project,
          component: scope.component,
        };

        const perEnv = await Promise.allSettled(
          sortedEnvs.map(async env => {
            const current = await api.getCosts(namespace!, env, {
              ...scopeOpts,
              startTime,
              endTime,
              granularity: view === 'graph' ? granularity : undefined,
            });
            const previous = await api.getCosts(namespace!, env, {
              ...scopeOpts,
              startTime: prevStart,
              endTime: prevEnd,
            });
            const recommendations =
              level === 'component'
                ? await api.getCostRecommendations(namespace!, env, {
                    ...scopeOpts,
                    startTime,
                    endTime,
                  })
                : { items: [] as CostRecommendationItem[] };
            return {
              current: current.items,
              previous: previous.items,
              recommendations: recommendations.items,
            };
          }),
        );

        const fulfilled = perEnv.filter(
          (
            r,
          ): r is PromiseFulfilledResult<{
            current: CostItem[];
            previous: CostItem[];
            recommendations: CostRecommendationItem[];
          }> => r.status === 'fulfilled',
        );

        // Only fail outright when *every* environment failed; otherwise show
        // the environments that resolved (a single disabled env shouldn't blank
        // the whole page).
        if (fulfilled.length === 0) {
          const firstRejected = perEnv.find(r => r.status === 'rejected') as
            | PromiseRejectedResult
            | undefined;
          const reason = firstRejected?.reason;
          throw reason instanceof Error
            ? reason
            : new Error('Failed to load cost data');
        }

        const currentItems = fulfilled.flatMap(r => r.value.current);
        const previousItems = fulfilled.flatMap(r => r.value.previous);
        const recommendations = fulfilled.flatMap(r => r.value.recommendations);

        return buildCostInsightsData({
          level,
          currentItems,
          previousItems,
          recommendations,
          windowStart: startTime,
          windowEnd: endTime,
          now: new Date(),
        });
      },
      { enabled, keepPreviousData: true },
    );

  return {
    data,
    loading,
    isRefetching,
    error: error ? error.message || 'Failed to load cost data' : null,
    refresh: refetch,
  };
}
