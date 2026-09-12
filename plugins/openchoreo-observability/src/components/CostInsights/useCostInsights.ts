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
import { buildCostInsightsData } from './costAggregation';
import { fetchBindingInfoByEnv, normalizeEnv } from './optimizeChange';
import type { CostInsightsData, CostScope, CostScopeLevel } from './types';

export interface UseCostInsightsParams {
  /** Atomic scopes to query (one per selected item at `level`). */
  scopes: CostScope[];
  /** The tier the rows are grouped by (deepest populated selection). */
  level: CostScopeLevel;
  /** Selected environment names (multi-select). */
  environments: string[];
  timeRange: string;
  customStartTime?: string;
  customEndTime?: string;
  /** Cost-API granularity (e.g. `1h`, `1d`) for the time-series charts. */
  granularity: string;
  /**
   * Fetch only current + previous cost for the catalog overview
   * card, which renders just the total.
   */
  summaryOnly?: boolean;
}

/** Stable key for a scope, so the query cache and fan-out stay deterministic. */
const scopeKey = (scope: CostScope): string =>
  `${scope.namespace ?? ''}/${scope.project ?? ''}/${scope.component ?? ''}`;

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
  const { scopes, level, environments, timeRange, granularity } = params;
  const summaryOnly = params.summaryOnly ?? false;
  // Dedupe so a repeated env or scope can't fan out duplicate requests and
  // double-count the aggregated totals.
  const sortedEnvs = [...new Set(environments)].sort();
  const uniqueScopes = [...new Map(scopes.map(s => [scopeKey(s), s])).values()];
  const sortedScopeKeys = uniqueScopes.map(scopeKey).sort();

  const enabled = uniqueScopes.length > 0 && sortedEnvs.length > 0;

  const { data, loading, isRefetching, error, refetch } =
    useOpenChoreoQuery<CostInsightsData>(
      [
        'cost-insights',
        level,
        sortedScopeKeys.join('|'),
        sortedEnvs.join(','),
        timeRange,
        params.customStartTime ?? '',
        params.customEndTime ?? '',
        granularity,
        summaryOnly ? 'summary' : 'full',
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

        // Current calendar month, for the forecast chart (ignores the time range).
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStartIso = monthStart.toISOString();
        const nowIso = now.toISOString();

        // The cost API is per (namespace, environment) with an optional
        // project/component filter, so fan out across every selected scope and
        // environment and aggregate the flat items client-side.
        const requests = uniqueScopes.flatMap(scope =>
          sortedEnvs.map(env => ({ scope, env })),
        );

        const perRequest = await Promise.allSettled(
          requests.map(async ({ scope, env }) => {
            const ns = scope.namespace!;
            const scopeOpts = {
              project: scope.project,
              component: scope.component,
            };
            // Accumulated cost drives rows/summary/scatter/saving in both views
            // and shares the recommendation's (non-bucketed) pricing basis.
            const current = await api.getCosts(ns, env, {
              ...scopeOpts,
              startTime,
              endTime,
            });
            // Time-bucketed cost drives the graph's time-series charts; its
            // per-bucket totals need not sum to the accumulated total. Degrade
            // gracefully: a series failure shouldn't drop the request's data.
            // The summary-only card skips all of these.
            const series = summaryOnly
              ? { items: [] as CostItem[] }
              : await api
                  .getCosts(ns, env, {
                    ...scopeOpts,
                    startTime,
                    endTime,
                    granularity,
                  })
                  .catch(() => ({ items: [] as CostItem[] }));
            // Month-to-date daily cost for the forecast chart
            const monthToDate = summaryOnly
              ? { items: [] as CostItem[] }
              : await api
                  .getCosts(ns, env, {
                    ...scopeOpts,
                    startTime: monthStartIso,
                    endTime: nowIso,
                    granularity: '1d',
                  })
                  .catch(() => ({ items: [] as CostItem[] }));
            // Month-to-date recommendations drive the forecast's "if applied"
            // curve: the saving rate is measured over month start to now, then
            // extrapolated to month end (same window as the actual curve).
            const monthToDateRecommendations = summaryOnly
              ? { items: [] as CostRecommendationItem[] }
              : await api
                  .getCostRecommendations(ns, env, {
                    ...scopeOpts,
                    startTime: monthStartIso,
                    endTime: nowIso,
                  })
                  .catch(() => ({ items: [] as CostRecommendationItem[] }));
            const previous = await api.getCosts(ns, env, {
              ...scopeOpts,
              startTime: prevStart,
              endTime: prevEnd,
            });
            // Degrade gracefully: a recommendation failure shouldn't drop the
            // request's cost data with it.
            const recommendations = summaryOnly
              ? { items: [] as CostRecommendationItem[] }
              : await api
                  .getCostRecommendations(ns, env, {
                    ...scopeOpts,
                    startTime,
                    endTime,
                  })
                  .catch(() => ({ items: [] as CostRecommendationItem[] }));
            return {
              current: current.items,
              series: series.items,
              monthToDate: monthToDate.items,
              monthToDateRecommendations: monthToDateRecommendations.items,
              previous: previous.items,
              recommendations: recommendations.items,
            };
          }),
        );

        const fulfilled = perRequest.filter(
          (
            r,
          ): r is PromiseFulfilledResult<{
            current: CostItem[];
            series: CostItem[];
            monthToDate: CostItem[];
            monthToDateRecommendations: CostRecommendationItem[];
            previous: CostItem[];
            recommendations: CostRecommendationItem[];
          }> => r.status === 'fulfilled',
        );

        // Only fail outright when *every* request failed; otherwise show the
        // data that resolved (a single disabled env/scope shouldn't blank the
        // whole page).
        if (fulfilled.length === 0) {
          const firstRejected = perRequest.find(
            r => r.status === 'rejected',
          ) as PromiseRejectedResult | undefined;
          const reason = firstRejected?.reason;
          throw reason instanceof Error
            ? reason
            : new Error('Failed to load cost data');
        }

        const currentItems = fulfilled.flatMap(r => r.value.current);
        const seriesItems = fulfilled.flatMap(r => r.value.series);
        const monthToDateItems = fulfilled.flatMap(r => r.value.monthToDate);
        const mtdRecommendations = fulfilled.flatMap(
          r => r.value.monthToDateRecommendations,
        );
        const previousItems = fulfilled.flatMap(r => r.value.previous);
        const recommendations = fulfilled.flatMap(r => r.value.recommendations);

        // A recommendation is only trustworthy when its window's usage reflects
        // the current spec. If the ReleaseBinding was updated after the window
        // started, the samples include the pre-change spec, so we withhold those
        // (keyed by env -> spec update time) and flag the row. For valid rows we
        // override the window-derived "current" request strings with live spec
        // values (display + diff only; costs stay window-based). The binding
        // lookup is per component, so this refinement runs only when a single
        // component is in scope (the only case that shows Optimize anyway).
        const staleRecommendationEnvs = new Map<string, string>();
        const singleComponent =
          level === 'component' && uniqueScopes.length === 1
            ? uniqueScopes[0]
            : undefined;
        if (singleComponent && recommendations.length > 0) {
          const openchoreoBaseUrl = await discovery.getBaseUrl('openchoreo');
          const infoByEnv = await fetchBindingInfoByEnv({
            openchoreoBaseUrl,
            fetchApi,
            namespaceName: singleComponent.namespace!,
            projectName: singleComponent.project!,
            componentName: singleComponent.component!,
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
          monthToDateItems,
          monthToDateRecommendations: mtdRecommendations,
          previousItems,
          recommendations,
          staleRecommendationEnvs,
          monthStart,
          now,
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
