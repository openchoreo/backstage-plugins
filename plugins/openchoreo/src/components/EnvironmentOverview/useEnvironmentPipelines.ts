import { useEffect, useState, useCallback } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

export interface PipelinePosition {
  pipelineName: string;
  pipelineEntityRef: string;
  environments: string[];
  currentIndex: number;
}

export interface UseEnvironmentPipelinesResult {
  pipelines: PipelinePosition[];
  loading: boolean;
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

  const [pipelines, setPipelines] = useState<PipelinePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const environmentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ENVIRONMENT] ||
    entity.metadata.name;
  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  const fetchPipelines = useCallback(async () => {
    if (!namespaceName || !environmentName) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

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
        const spec = pipeline.spec as {
          promotionPaths?: Array<{
            sourceEnvironment?: string;
            targetEnvironments?: Array<{ name: string }>;
          }>;
        };
        if (!spec?.promotionPaths) continue;

        const allEnvironments = new Set<string>();
        for (const path of spec.promotionPaths) {
          if (path.sourceEnvironment) {
            allEnvironments.add(path.sourceEnvironment);
          }
          for (const target of path.targetEnvironments || []) {
            if (target.name) {
              allEnvironments.add(target.name);
            }
          }
        }

        // Check if this environment is in the pipeline
        if (allEnvironments.has(environmentName)) {
          // Build ordered environment list from promotion paths
          const envOrder: string[] = [];
          const visited = new Set<string>();

          // Find the starting environment (one that's only a source, not a target)
          const targets = new Set<string>();
          for (const path of spec.promotionPaths) {
            for (const target of path.targetEnvironments || []) {
              targets.add(target.name);
            }
          }

          // Start with environments that are sources but not targets
          for (const path of spec.promotionPaths) {
            if (
              path.sourceEnvironment &&
              !targets.has(path.sourceEnvironment) &&
              !visited.has(path.sourceEnvironment)
            ) {
              envOrder.push(path.sourceEnvironment);
              visited.add(path.sourceEnvironment);
            }
          }

          // Add remaining environments in order
          for (const path of spec.promotionPaths) {
            if (
              path.sourceEnvironment &&
              !visited.has(path.sourceEnvironment)
            ) {
              envOrder.push(path.sourceEnvironment);
              visited.add(path.sourceEnvironment);
            }
            for (const target of path.targetEnvironments || []) {
              if (!visited.has(target.name)) {
                envOrder.push(target.name);
                visited.add(target.name);
              }
            }
          }

          const currentIndex = envOrder.findIndex(
            e => e.toLowerCase() === environmentName.toLowerCase(),
          );

          matchingPipelines.push({
            pipelineName: pipeline.metadata.title || pipeline.metadata.name,
            pipelineEntityRef: `deploymentpipeline:${
              pipeline.metadata.namespace || 'default'
            }/${pipeline.metadata.name}`,
            environments: envOrder,
            currentIndex,
          });
        }
      }

      setPipelines(matchingPipelines);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [namespaceName, environmentName, catalogApi]);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  return { pipelines, loading, error, environmentName };
}
