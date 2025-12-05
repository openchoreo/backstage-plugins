import { useEffect, useState, useCallback } from 'react';
import { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
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

// Use generated types from OpenAPI spec
type ReleaseBindingResponse =
  OpenChoreoComponents['schemas']['ReleaseBindingResponse'];
type APIResponse = OpenChoreoComponents['schemas']['APIResponse'];
type ListResponse = OpenChoreoComponents['schemas']['ListResponse'];

// Response type from /release-bindings endpoint
type ReleaseBindingsResponse = APIResponse & {
  data?: ListResponse & {
    items?: ReleaseBindingResponse[];
  };
};

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
  const discovery = useApi(discoveryApiRef);
  const identity = useApi(identityApiRef);

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
                apiFetch<ReleaseBindingsResponse>({
                  endpoint: API_ENDPOINTS.RELEASE_BINDINGS,
                  discovery,
                  identity,
                  params: {
                    componentName,
                    projectName,
                    organizationName: organization,
                  },
                }),
                // Fetch builds for this component
                (async () => {
                  try {
                    const { token } = await identity.getCredentials();
                    const baseUrl = await discovery.getBaseUrl('openchoreo');
                    const response = await fetch(
                      `${baseUrl}/builds?componentName=${encodeURIComponent(
                        componentName,
                      )}&projectName=${encodeURIComponent(
                        projectName,
                      )}&organizationName=${encodeURIComponent(organization)}`,
                      {
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                      },
                    );
                    if (!response.ok) return null;
                    return await response.json();
                  } catch {
                    return null;
                  }
                })(),
              ]);

              // Parse deployment status from release bindings
              const deploymentStatus: ComponentDeploymentStatus = {};

              const bindings = releaseBindingsData?.data?.items;
              if (bindings && Array.isArray(bindings)) {
                bindings.forEach((binding: ReleaseBindingResponse) => {
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
  }, [systemEntity, catalogApi, discovery, identity]);

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
