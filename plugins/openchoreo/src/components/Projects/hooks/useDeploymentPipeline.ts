import { useCallback, useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import {
  CHOREO_ANNOTATIONS,
  type DeploymentPipelineResponse,
} from '@openchoreo/backstage-plugin-common';
import type { PipelinePromotionPath } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

interface DeploymentPipelineData {
  name: string;
  resourceName: string;
  environments: string[];
  promotionPaths: PipelinePromotionPath[];
  dataPlane?: string;
  pipelineEntityRef?: string;
}

export const useDeploymentPipeline = () => {
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);

  const [data, setData] = useState<DeploymentPipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    const fetchPipelineData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get project and namespace from system entity
        const projectName = entity.metadata.name;
        const namespace =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

        if (!projectName || !namespace) {
          throw new Error('Missing project or namespace information');
        }

        // Fetch deployment pipeline from Backstage backend
        const pipelineData: DeploymentPipelineResponse =
          await client.fetchDeploymentPipeline(projectName, namespace);

        // Extract environments from promotion paths in order, and
        // build the structured promotionPaths the visualization needs.
        const environments: string[] = [];
        const addedEnvs = new Set<string>();
        const promotionPaths: PipelinePromotionPath[] = [];

        if (
          pipelineData.promotionPaths &&
          pipelineData.promotionPaths.length > 0
        ) {
          pipelineData.promotionPaths.forEach(path => {
            // sourceEnvironmentRef may be a string (old API) or object { name } (new API)
            const sourceEnvName =
              typeof path.sourceEnvironmentRef === 'string'
                ? path.sourceEnvironmentRef
                : (path.sourceEnvironmentRef as unknown as { name: string })
                    ?.name ?? '';
            if (sourceEnvName && !addedEnvs.has(sourceEnvName)) {
              environments.push(sourceEnvName);
              addedEnvs.add(sourceEnvName);
            }
            const targets = (path.targetEnvironmentRefs ?? [])
              .filter(t => !!t.name)
              .map(t => ({ name: t.name }));
            for (const target of targets) {
              if (!addedEnvs.has(target.name)) {
                environments.push(target.name);
                addedEnvs.add(target.name);
              }
            }
            if (sourceEnvName && targets.length > 0) {
              promotionPaths.push({ source: sourceEnvName, targets });
            }
          });
        }

        setData({
          name: pipelineData.displayName || pipelineData.name,
          resourceName: pipelineData.name,
          environments:
            environments.length > 0
              ? environments
              : ['development', 'staging', 'production'],
          promotionPaths,
          dataPlane: undefined, // Not included in the response schema
          pipelineEntityRef: `deploymentpipeline:${
            entity.metadata.namespace || 'default'
          }/${pipelineData.name}`,
        });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPipelineData();
  }, [entity, client, refreshKey]);

  return { data, loading, error, refetch };
};
