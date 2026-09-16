import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { observabilityApiRef } from '../../api/ObservabilityApi';
import {
  DoraGranularity,
  DoraMetricsResponse,
  DoraSearchScope,
} from '../../types';
import { BREAKDOWN_CONCURRENCY, mapWithConcurrency } from './utils';

export type InsightsLevel = 'domain' | 'system' | 'component';

export interface DoraBreakdownRow {
  /** Display name of the child (project, component, or environment). */
  name: string;
  /** Scope used to query the child's metrics. */
  scope: DoraSearchScope;
  /** Catalog entity behind the row, when one exists — drives row navigation. */
  entityRef?: { kind: string; namespace: string; name: string };
  /** Child's summary; undefined while loading or when the query failed. */
  summary?: DoraMetricsResponse['summary'];
}

export interface UseDoraBreakdownResult {
  rows: DoraBreakdownRow[];
  /** Per-environment slices of the current scope (for the env cards section). */
  envRows: DoraBreakdownRow[];
  /** Environment names of the namespace (for the env filter). */
  environments: string[];
  loading: boolean;
  error: string | null;
  /** Re-runs the breakdown queries; pairs with `useDoraInsights.refetch`. */
  refetch: () => void;
}

/**
 * Resolves the "one level down" breakdown of the wireframe: projects of a
 * namespace, components of a project, or environments of a component — then
 * fetches each child's DORA summary in parallel. Children come from the
 * catalog (Systems/Components/Environments synced from the control plane).
 */
export function useDoraBreakdown(
  level: InsightsLevel | null,
  scope: DoraSearchScope | null,
  rangeDays: number,
  granularity: DoraGranularity,
): UseDoraBreakdownResult {
  const catalogApi = useApi(catalogApiRef);
  const observabilityApi = useApi(observabilityApiRef);
  const [rows, setRows] = useState<DoraBreakdownRow[]>([]);
  const [envRows, setEnvRows] = useState<DoraBreakdownRow[]>([]);
  const [environments, setEnvironments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const refetch = useCallback(() => setReloadToken(token => token + 1), []);

  const scopeKey = scope
    ? `${scope.namespace}/${scope.project ?? ''}/${scope.component ?? ''}/${
        scope.environment ?? ''
      }`
    : '';

  // The rows on screen belong to one query. Asking a different question --
  // another scope, window or granularity -- makes them answers to a question
  // nobody asked any more, so they go before the new request starts rather than
  // sitting under the new headline numbers until it lands, or staying put if it
  // fails. A plain refetch asks the same question again and keeps them, so
  // Refresh does not blank the page.
  const queryKey = `${level ?? ''}/${scopeKey}/${rangeDays}/${granularity}`;
  const loadedKey = useRef<string | null>(null);
  // The environment list is a property of the namespace alone, so it survives a
  // change of window or granularity but not a change of namespace -- where
  // keeping it would offer, and the caller would auto-select, an environment
  // that belongs to somewhere else.
  const loadedEnvironmentNamespace = useRef<string | null>(null);

  useEffect(() => {
    if (!level || !scope) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;

    const fetchBreakdown = async () => {
      try {
        if (loadedKey.current !== queryKey) {
          setRows([]);
          setEnvRows([]);
        }
        if (loadedEnvironmentNamespace.current !== scope.namespace) {
          setEnvironments([]);
        }
        setLoading(true);
        setError(null);

        const { items: envEntities } = await catalogApi.getEntities({
          filter: {
            kind: 'Environment',
            'metadata.namespace': scope.namespace,
          },
          fields: ['metadata.name'],
        });
        const envNames = envEntities.map(e => e.metadata.name);
        if (!cancelled) {
          setEnvironments(envNames);
          loadedEnvironmentNamespace.current = scope.namespace;
        }

        let children: DoraBreakdownRow[] = [];
        if (level === 'domain') {
          const { items } = await catalogApi.getEntities({
            filter: {
              kind: 'System',
              [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]:
                scope.namespace,
            },
            fields: ['kind', 'metadata.name', 'metadata.namespace'],
          });
          children = items.map(e => ({
            name: e.metadata.name,
            scope: {
              namespace: scope.namespace,
              project: e.metadata.name,
              environment: scope.environment,
            },
            entityRef: {
              kind: e.kind,
              namespace: e.metadata.namespace ?? 'default',
              name: e.metadata.name,
            },
          }));
        } else if (level === 'system') {
          const { items } = await catalogApi.getEntities({
            filter: {
              kind: 'Component',
              [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]:
                scope.namespace,
              [`metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`]:
                scope.project ?? '',
            },
            fields: [
              'kind',
              'metadata.name',
              'metadata.namespace',
              'metadata.annotations',
            ],
          });
          children = items.map(e => ({
            name:
              e.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT] ??
              e.metadata.name,
            scope: {
              namespace: scope.namespace,
              project: scope.project,
              component:
                e.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT] ??
                e.metadata.name,
              environment: scope.environment,
            },
            entityRef: {
              kind: e.kind,
              namespace: e.metadata.namespace ?? 'default',
              name: e.metadata.name,
            },
          }));
        } else {
          children = envNames.map(name => ({
            name,
            scope: { ...scope, environment: name },
          }));
        }

        // Env cards slice the *current* scope per environment. At component
        // level the breakdown table already is per-environment, so reuse it.
        const envChildren: DoraBreakdownRow[] =
          level === 'component'
            ? []
            : envNames.map(name => ({
                name,
                scope: { ...scope, environment: name },
              }));

        // The environment list is loaded; the summaries are not asked for until
        // the caller has settled on one of them. Every metric below a namespace
        // or project is scoped to a single environment by design -- unscoped it
        // would aggregate across observability planes, which percentiles cannot
        // do -- so a request made while the filter is still empty is one nobody
        // can serve meaningfully. Component level is already per-environment,
        // and a namespace with no environments has nothing to wait for.
        const awaitingEnvironment =
          level !== 'component' && !scope.environment && envNames.length > 0;
        if (awaitingEnvironment) {
          return;
        }

        const endTime = new Date();
        const startTime = new Date(
          endTime.getTime() - rangeDays * 24 * 60 * 60 * 1000,
        );
        const fetchSummary = async (child: DoraBreakdownRow) => {
          try {
            const response = await observabilityApi.getDoraMetrics(
              child.scope,
              {
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                // Only `summary` is read here, and summaries cover the exact
                // requested window regardless of granularity — but pass the
                // page's granularity so every request on the page describes the
                // same view.
                granularity,
              },
            );
            return { ...child, summary: response.summary };
          } catch {
            return child; // row renders with em-dashes rather than failing the table
          }
        };
        // One request per child, but capped — at namespace level this is every
        // project plus every environment, and each also passes through the
        // observer URL cache.
        const [summaries, envSummaries] = await Promise.all([
          mapWithConcurrency(children, BREAKDOWN_CONCURRENCY, fetchSummary),
          mapWithConcurrency(envChildren, BREAKDOWN_CONCURRENCY, fetchSummary),
        ]);

        if (!cancelled) {
          // Most active first. The table's leading Deployments column renders this
          // ordering as a descending bar, so the sort explains itself and needs no
          // caption above the table.
          summaries.sort(
            (a, b) =>
              (b.summary?.deploymentFrequency?.total ?? 0) -
              (a.summary?.deploymentFrequency?.total ?? 0),
          );
          setRows(summaries);
          setEnvRows(level === 'component' ? summaries : envSummaries);
          loadedKey.current = queryKey;
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load breakdown',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchBreakdown();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    level,
    scopeKey,
    rangeDays,
    granularity,
    queryKey,
    reloadToken,
    catalogApi,
    observabilityApi,
  ]);

  return { rows, envRows, environments, loading, error, refetch };
}
