import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { observabilityApiRef } from '../../api/ObservabilityApi';
import { DoraMetricsResponse, DoraSearchScope } from '../../types';
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

  useEffect(() => {
    if (!level || !scope) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;

    const fetchBreakdown = async () => {
      try {
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
                granularity: 'weekly',
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
          // Most active first, mirroring the wireframe's "sorted by deployment frequency".
          summaries.sort(
            (a, b) =>
              (b.summary?.deploymentFrequency?.total ?? 0) -
              (a.summary?.deploymentFrequency?.total ?? 0),
          );
          setRows(summaries);
          setEnvRows(level === 'component' ? summaries : envSummaries);
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
  }, [level, scopeKey, rangeDays, reloadToken, catalogApi, observabilityApi]);

  return { rows, envRows, environments, loading, error, refetch };
}
