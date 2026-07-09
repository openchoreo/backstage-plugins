import { stringifyEntityRef } from '@backstage/catalog-model';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  useOpenChoreoQuery,
  type PipelinePromotionPath,
} from '@openchoreo/backstage-plugin-react';

export interface PipelinePosition {
  pipelineName: string;
  pipelineEntityRef: string;
  environments: string[];
  promotionPaths: PipelinePromotionPath[];
  currentIndex: number;
}

export interface UseEnvironmentPipelinesResult {
  pipelines: PipelinePosition[];
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  environmentName: string;
}

/**
 * Hook to fetch all deployment pipelines that include the current environment.
 * Reusable across EnvironmentPromotionCard and EnvironmentPipelinesTab.
 */
export function useEnvironmentPipelines(): UseEnvironmentPipelinesResult {
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);

  const environmentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ENVIRONMENT] ||
    entity.metadata.name;
  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  const { data, loading, isRefetching, error } = useOpenChoreoQuery(
    [
      'environment-pipelines',
      stringifyEntityRef(entity),
      namespaceName,
      environmentName,
    ],
    async (): Promise<PipelinePosition[]> => {
      // Narrows namespaceName to string (query enabled only when set) so the
      // filter stays assignable to EntityFilterQuery.
      if (!namespaceName) return [];
      // Find DeploymentPipeline entities in this namespace that reference this environment
      const { items: pipelineEntities } = await catalogApi.getEntities({
        filter: {
          kind: 'DeploymentPipeline',
          'metadata.namespace': namespaceName,
        },
      });

      const matchingPipelines: PipelinePosition[] = [];

      // Find all pipelines that include this environment
      for (const pipeline of pipelineEntities) {
        const rawSpec = pipeline.spec as {
          promotionPaths?: Array<{
            // Catalog entity may use either the old (string) or new (object) shape:
            sourceEnvironment?: string;
            sourceEnvironmentRef?: string | { name?: string };
            targetEnvironments?: Array<{ name: string }>;
            targetEnvironmentRefs?: Array<{ name: string }>;
          }>;
        };
        if (!rawSpec?.promotionPaths) continue;

        // Normalize to a single shape:
        // { source: string, targets: { name }[] }[]
        const normalized = rawSpec.promotionPaths.map(path => {
          const source =
            path.sourceEnvironment ??
            (typeof path.sourceEnvironmentRef === 'string'
              ? path.sourceEnvironmentRef
              : path.sourceEnvironmentRef?.name) ??
            '';
          const rawTargets =
            path.targetEnvironments ?? path.targetEnvironmentRefs ?? [];
          const targets = rawTargets
            .filter(t => !!t.name)
            .map(t => ({ name: t.name }));
          return { source, targets };
        });

        const allEnvironments = new Set<string>();
        for (const path of normalized) {
          if (path.source) allEnvironments.add(path.source);
          for (const target of path.targets) allEnvironments.add(target.name);
        }

        // Check if this environment is in the pipeline
        if (allEnvironments.has(environmentName)) {
          // Build ordered environment list (used by the chip-strip fallback)
          const envOrder: string[] = [];
          const visited = new Set<string>();

          const allTargets = new Set<string>();
          for (const path of normalized) {
            for (const target of path.targets) allTargets.add(target.name);
          }

          // Sources that aren't targets first (root environments)
          for (const path of normalized) {
            if (
              path.source &&
              !allTargets.has(path.source) &&
              !visited.has(path.source)
            ) {
              envOrder.push(path.source);
              visited.add(path.source);
            }
          }

          // Then remaining environments in promotion order
          for (const path of normalized) {
            if (path.source && !visited.has(path.source)) {
              envOrder.push(path.source);
              visited.add(path.source);
            }
            for (const target of path.targets) {
              if (!visited.has(target.name)) {
                envOrder.push(target.name);
                visited.add(target.name);
              }
            }
          }

          const promotionPaths: PipelinePromotionPath[] = normalized
            .filter(p => p.source && p.targets.length > 0)
            .map(p => ({ source: p.source, targets: p.targets }));

          const currentIndex = envOrder.findIndex(
            e => e.toLowerCase() === environmentName.toLowerCase(),
          );

          matchingPipelines.push({
            pipelineName: pipeline.metadata.title || pipeline.metadata.name,
            pipelineEntityRef: `deploymentpipeline:${
              pipeline.metadata.namespace || 'default'
            }/${pipeline.metadata.name}`,
            environments: envOrder,
            promotionPaths,
            currentIndex,
          });
        }
      }

      return matchingPipelines;
    },
    { enabled: !!namespaceName && !!environmentName },
  );

  return {
    pipelines: data ?? [],
    loading,
    isRefetching,
    error,
    environmentName,
  };
}
