import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import {
  useOpenChoreoQuery,
  calculateTimeRange,
} from '@openchoreo/backstage-plugin-react';
import { observabilityApiRef } from '../../api/ObservabilityApi';
import type { CostItem, CostRecommendationItem } from '../../types';
import { buildCostInsightsData, deriveLevel } from './costAggregation';
import { fetchBindingInfoByEnv, normalizeEnv } from './optimizeChange';
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
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
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

        // Charts (all levels) and the component table both need recommendations.
        const needsRecs = view === 'graph' || level === 'component';
        const isGraph = view === 'graph';

        const perEnv = await Promise.allSettled(
          sortedEnvs.map(async env => {
            // Accumulated cost drives rows/summary/scatter/saving in both views
            // and shares the recommendation's (non-bucketed) pricing basis.
            const current = await api.getCosts(namespace!, env, {
              ...scopeOpts,
              startTime,
              endTime,
            });
            // Time-bucketed cost drives the graph's time-series charts only; its
            // per-bucket totals need not sum to the accumulated total. Degrade
            // gracefully: a series failure shouldn't drop the env's other data.
            const series = isGraph
              ? await api
                  .getCosts(namespace!, env, {
                    ...scopeOpts,
                    startTime,
                    endTime,
                    granularity,
                  })
                  .catch(() => ({ items: [] as CostItem[] }))
              : { items: [] as CostItem[] };
            const previous = await api.getCosts(namespace!, env, {
              ...scopeOpts,
              startTime: prevStart,
              endTime: prevEnd,
            });
            // Degrade gracefully: a recommendation failure shouldn't drop the
            // env's cost data with it.
            const recommendations = needsRecs
              ? await api
                  .getCostRecommendations(namespace!, env, {
                    ...scopeOpts,
                    startTime,
                    endTime,
                  })
                  .catch(() => ({ items: [] as CostRecommendationItem[] }))
              : { items: [] as CostRecommendationItem[] };
            return {
              current: current.items,
              series: series.items,
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
            series: CostItem[];
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
        const seriesItems = fulfilled.flatMap(r => r.value.series);
        const previousItems = fulfilled.flatMap(r => r.value.previous);
        const recommendations = fulfilled.flatMap(r => r.value.recommendations);

        // A recommendation is only trustworthy when its window's usage reflects
        // the current spec. If the ReleaseBinding was updated after the window
        // started, the samples include the pre-change spec, so we withhold those
        // (keyed by env -> spec update time) and flag the row. For valid rows we
        // override the window-derived "current" request strings with live spec
        // values (display + diff only; costs stay window-based).
        const staleRecommendationEnvs = new Map<string, string>();
        if (level === 'component' && recommendations.length > 0) {
          const openchoreoBaseUrl = await discovery.getBaseUrl('openchoreo');
          const infoByEnv = await fetchBindingInfoByEnv({
            openchoreoBaseUrl,
            fetchApi,
            namespaceName: namespace!,
            projectName: scope.project!,
            componentName: scope.component!,
          });
          const windowStartMs = new Date(startTime).getTime();
          // Buffer so the settling period right after a spec change (pods rolling
          // out) doesn't skew the recommendation.
          const SETTLING_BUFFER_MS = 5 * 60 * 1000;
          for (const rec of recommendations) {
            const info = infoByEnv.get(normalizeEnv(rec.environment));
            if (!info) continue;
            const updatedMs = info.lastSpecUpdateTime
              ? new Date(info.lastSpecUpdateTime).getTime()
              : NaN;
            if (
              Number.isFinite(updatedMs) &&
              updatedMs + SETTLING_BUFFER_MS > windowStartMs
            ) {
              staleRecommendationEnvs.set(
                rec.environment,
                info.lastSpecUpdateTime!,
              );
              continue;
            }
            rec.current = {
              ...rec.current,
              cpuRequest: info.cpuRequest ?? rec.current.cpuRequest,
              cpuLimit: info.cpuLimit ?? rec.current.cpuLimit,
              memoryRequest: info.memoryRequest ?? rec.current.memoryRequest,
              memoryLimit: info.memoryLimit ?? rec.current.memoryLimit,
            };
          }
        }

        return buildCostInsightsData({
          level,
          currentItems,
          seriesItems,
          previousItems,
          recommendations,
          staleRecommendationEnvs,
          windowStart: startTime,
          windowEnd: endTime,
          now: new Date(),
        });
      },
      // No keepPreviousData: a window/view/scope change shows the centered loader
      // rather than stale data. Manual refresh keeps its key and uses the overlay.
      { enabled },
    );

  return {
    data,
    loading,
    isRefetching,
    error: error ? error.message || 'Failed to load cost data' : null,
    refresh: refetch,
  };
}
