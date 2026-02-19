import { useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import {
  CHOREO_ANNOTATIONS,
  type OpenChoreoLegacyComponents,
} from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

type DeploymentPipelineResponse =
  OpenChoreoLegacyComponents['schemas']['DeploymentPipelineResponse'];

interface DeploymentPipelineData {
  name: string;
  environments: string[];
  dataPlane?: string;
  pipelineEntityRef?: string;
}

export const useDeploymentPipeline = () => {
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);

  const [data, setData] = useState<DeploymentPipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

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

        // Extract environments from promotion paths in order
        // The promotion paths define the deployment flow: source -> targets
        // We need to maintain this order
        const environments: string[] = [];
        const addedEnvs = new Set<string>();

        if (
          pipelineData.promotionPaths &&
          pipelineData.promotionPaths.length > 0
        ) {
          pipelineData.promotionPaths.forEach(path => {
            // Add source environment first
            if (
              path.sourceEnvironmentRef &&
              !addedEnvs.has(path.sourceEnvironmentRef)
            ) {
              environments.push(path.sourceEnvironmentRef);
              addedEnvs.add(path.sourceEnvironmentRef);
            }
            // Then add target environments in order
            if (path.targetEnvironmentRefs) {
              path.targetEnvironmentRefs.forEach(target => {
                if (target.name && !addedEnvs.has(target.name)) {
                  environments.push(target.name);
                  addedEnvs.add(target.name);
                }
              });
            }
          });
        }

        setData({
          name: pipelineData.displayName || pipelineData.name,
          environments:
            environments.length > 0
              ? environments
              : ['development', 'staging', 'production'],
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
  }, [entity, client]);

  return { data, loading, error };
};
