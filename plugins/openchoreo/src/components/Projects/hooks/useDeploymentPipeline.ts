import { useEffect, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useApi,
  discoveryApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import {
  CHOREO_ANNOTATIONS,
  type OpenChoreoComponents,
} from '@openchoreo/backstage-plugin-common';
import { apiFetch } from '../../../api/client';
import { API_ENDPOINTS } from '../../../constants';

type DeploymentPipelineResponse =
  OpenChoreoComponents['schemas']['DeploymentPipelineResponse'];

interface DeploymentPipelineData {
  name: string;
  environments: string[];
  dataPlane?: string;
}

export const useDeploymentPipeline = () => {
  const { entity } = useEntity();
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);

  const [data, setData] = useState<DeploymentPipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPipelineData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get project and organization from system entity
        const projectName = entity.metadata.name;
        const organization =
          entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

        if (!projectName || !organization) {
          throw new Error('Missing project or organization information');
        }

        // Fetch deployment pipeline from Backstage backend
        const pipelineData = await apiFetch<DeploymentPipelineResponse>({
          endpoint: API_ENDPOINTS.DEPLOYMENT_PIPELINE,
          discovery,
          identity,
          params: {
            projectName,
            organizationName: organization,
          },
        });

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
        });
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchPipelineData();
  }, [entity, discovery, identity]);

  return { data, loading, error };
};
