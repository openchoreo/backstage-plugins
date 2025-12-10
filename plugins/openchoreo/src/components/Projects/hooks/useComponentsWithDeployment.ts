import { useEffect, useState, useCallback } from 'react';
import { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { useApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';

// Deployment status with state information
export interface EnvironmentDeploymentStatus {
  isDeployed: boolean;
  status?: string; // Actual status from ReleaseBinding: Ready, NotReady, Failed, etc.
}

export interface ComponentDeploymentStatus {
  production?: EnvironmentDeploymentStatus;
  staging?: EnvironmentDeploymentStatus;
  development?: EnvironmentDeploymentStatus;
}

export interface ComponentWithDeployment extends Entity {
  deploymentStatus?: ComponentDeploymentStatus;
  latestBuild?: {
    name: string;
    status: string;
  };
}

interface UseComponentsWithDeploymentResult {
  components: ComponentWithDeployment[];
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useComponentsWithDeployment(
  systemEntity: Entity,
): UseComponentsWithDeploymentResult {
  const catalogApi = useApi(catalogApiRef);
  const client = useApi(openChoreoClientApiRef);

  const [components, setComponents] = useState<ComponentWithDeployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchComponents = useCallback(async () => {
    const projectName = systemEntity.metadata.name;
    const organization =
      systemEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

    if (!projectName || !organization) {
      setComponents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get all component entities that belong to this system
      const { items: componentEntities } = await catalogApi.getEntities({
        filter: {
          kind: 'Component',
          'spec.system': projectName,
        },
      });

      // Fetch deployment status for each component
      const componentsWithStatus = await Promise.all(
        componentEntities.map(
          async (component): Promise<ComponentWithDeployment> => {
            const componentName =
              component.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

            if (!componentName) {
              return component as ComponentWithDeployment;
            }

            try {
              // Fetch release bindings and builds in parallel
              const [releaseBindingsData, buildsData] = await Promise.all([
                client.fetchReleaseBindings(component as Entity),
                client.fetchBuilds(componentName, projectName, organization),
              ]);

              // Parse deployment status from release bindings
              const deploymentStatus: ComponentDeploymentStatus = {};

              const bindings = releaseBindingsData?.data?.items;
              if (bindings && Array.isArray(bindings)) {
                bindings.forEach(binding => {
                  const envName = binding.environment?.toLowerCase();
                  if (
                    envName &&
                    (envName === 'production' ||
                      envName === 'staging' ||
                      envName === 'development')
                  ) {
                    deploymentStatus[
                      envName as keyof ComponentDeploymentStatus
                    ] = {
                      isDeployed: true,
                      status: binding.status,
                    };
                  }
                });
              }

              // Get latest build status
              let latestBuild: { name: string; status: string } | undefined;
              if (
                buildsData &&
                Array.isArray(buildsData) &&
                buildsData.length > 0
              ) {
                const latest = buildsData[0]; // Builds are sorted by creation time descending
                if (latest.status && latest.name) {
                  latestBuild = {
                    name: latest.name,
                    status: latest.status,
                  };
                }
              }

              return {
                ...component,
                deploymentStatus,
                latestBuild,
              } as ComponentWithDeployment;
            } catch (err) {
              // If fetching data fails, return component without status
              return component as ComponentWithDeployment;
            }
          },
        ),
      );

      setComponents(componentsWithStatus);
    } catch (err) {
      setError(err as Error);
      setComponents([]);
    } finally {
      setLoading(false);
    }
  }, [systemEntity, catalogApi, client]);

  useEffect(() => {
    fetchComponents();
  }, [fetchComponents]);

  const refresh = useCallback(() => {
    fetchComponents();
  }, [fetchComponents]);

  return {
    components,
    loading,
    error,
    refresh,
  };
}
