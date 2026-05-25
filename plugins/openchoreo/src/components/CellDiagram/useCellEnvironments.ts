import { useEffect, useState } from 'react';
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';

// Cap each network-policy probe so a single hanging DataPlane doesn't
// indefinitely block the diagram from rendering.
const NETPOL_TIMEOUT_MS = 8000;

export interface CellEnvironment {
  name: string;
  displayName?: string;
  namespace: string;
  dataPlaneRef?: { kind?: string; name?: string };
  /** True when the env's DataPlane reports `networkpolicyprovider=cilium`. */
  hasRuntimeObservability: boolean;
}

export interface UseCellEnvironmentsResult {
  environments: CellEnvironment[];
  loading: boolean;
}

/**
 * Resolves the project's environments in deployment-pipeline order, hydrated
 * from the catalog and flagged with `hasRuntimeObservability` per the
 * environment's DataPlane network-policy provider.
 */
export const useCellEnvironments = (
  projectName: string | undefined,
  namespaceName: string | undefined,
): UseCellEnvironmentsResult => {
  const client = useApi(openChoreoClientApiRef);
  const catalogApi = useApi(catalogApiRef);
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [environments, setEnvironments] = useState<CellEnvironment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!projectName || !namespaceName) {
      setEnvironments([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);

    (async () => {
      try {
        const pipeline = await client.fetchDeploymentPipeline(
          projectName,
          namespaceName,
        );

        const orderedEnvNames: string[] = [];
        const seen = new Set<string>();
        const paths: Array<{
          sourceEnvironmentRef?: unknown;
          targetEnvironmentRefs?: Array<{ name?: string }>;
        }> = pipeline?.promotionPaths ?? [];
        for (const path of paths) {
          const sourceName =
            typeof path.sourceEnvironmentRef === 'string'
              ? path.sourceEnvironmentRef
              : (path.sourceEnvironmentRef as { name?: string } | undefined)
                  ?.name ?? '';
          if (sourceName && !seen.has(sourceName)) {
            orderedEnvNames.push(sourceName);
            seen.add(sourceName);
          }
          for (const target of path.targetEnvironmentRefs ?? []) {
            if (target?.name && !seen.has(target.name)) {
              orderedEnvNames.push(target.name);
              seen.add(target.name);
            }
          }
        }

        if (orderedEnvNames.length === 0) {
          if (!cancelled) setEnvironments([]);
          return;
        }

        const { items } = await catalogApi.getEntities({
          filter: { kind: 'Environment', 'metadata.namespace': namespaceName },
          fields: [
            'metadata.name',
            'metadata.namespace',
            'metadata.title',
            'metadata.annotations',
          ],
        });
        if (cancelled) return;

        const byName = new Map(items.map(e => [e.metadata.name, e]));
        const baseEnvs = orderedEnvNames.map(name => {
          const entry = byName.get(name);
          const ann = entry?.metadata.annotations ?? {};
          return {
            name,
            displayName: entry?.metadata.title ?? name,
            namespace: ann[CHOREO_ANNOTATIONS.NAMESPACE] ?? namespaceName,
            dataPlaneRef: {
              name: ann['openchoreo.io/data-plane-ref'],
              kind: ann[CHOREO_ANNOTATIONS.DATA_PLANE_REF_KIND] ?? 'DataPlane',
            },
          };
        });

        const baseUrl = await discoveryApi.getBaseUrl(
          'openchoreo-observability-backend',
        );
        const enriched = await Promise.all(
          baseEnvs.map(async env => {
            if (!env.namespace || !env.dataPlaneRef.name) {
              return { ...env, hasRuntimeObservability: false };
            }
            const controller = new AbortController();
            const timeout = setTimeout(
              () => controller.abort(),
              NETPOL_TIMEOUT_MS,
            );
            try {
              const params = new URLSearchParams({
                namespaceName: env.namespace,
                dpName: env.dataPlaneRef.name,
                dpKind: env.dataPlaneRef.kind ?? 'DataPlane',
              });
              const res = await fetchApi.fetch(
                `${baseUrl}/dataplane-netpol-provider?${params.toString()}`,
                { signal: controller.signal },
              );
              if (!res.ok) return { ...env, hasRuntimeObservability: false };
              const data = await res.json();
              return {
                ...env,
                hasRuntimeObservability:
                  data?.networkPolicyProvider === 'cilium',
              };
            } catch {
              return { ...env, hasRuntimeObservability: false };
            } finally {
              clearTimeout(timeout);
            }
          }),
        );

        if (!cancelled) setEnvironments(enriched);
      } catch {
        if (!cancelled) setEnvironments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectName, namespaceName, client, catalogApi, discoveryApi, fetchApi]);

  return { environments, loading };
};
