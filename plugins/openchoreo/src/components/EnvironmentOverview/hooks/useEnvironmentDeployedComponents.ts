import { useEffect, useState, useCallback } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import {
  openChoreoClientApiRef,
  ReleaseBinding,
} from '../../../api/OpenChoreoClientApi';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export interface DeployedComponent {
  name: string;
  displayName?: string;
  entityRef: string;
  projectName: string;
  releaseVersion?: string;
  status: 'Ready' | 'NotReady' | 'Failed' | 'Pending' | 'Unknown';
  endpoints?: number;
}

export interface EnvironmentStatusSummary {
  healthy: number;
  degraded: number;
  failed: number;
  pending: number;
  total: number;
}

interface UseEnvironmentDeployedComponentsResult {
  components: DeployedComponent[];
  statusSummary: EnvironmentStatusSummary;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useEnvironmentDeployedComponents(
  environmentEntity: Entity,
): UseEnvironmentDeployedComponentsResult {
  const client = useApi(openChoreoClientApiRef);
  const catalogApi = useApi(catalogApiRef);

  const [components, setComponents] = useState<DeployedComponent[]>([]);
  const [statusSummary, setStatusSummary] = useState<EnvironmentStatusSummary>({
    healthy: 0,
    degraded: 0,
    failed: 0,
    pending: 0,
    total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDeployedComponents = useCallback(async () => {
    const environmentName =
      environmentEntity.metadata.annotations?.[
        CHOREO_ANNOTATIONS.ENVIRONMENT
      ] || environmentEntity.metadata.name;
    const organization =
      environmentEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

    if (!environmentName || !organization) {
      setComponents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First, get all projects in this organization
      const { items: systemEntities } = await catalogApi.getEntities({
        filter: {
          kind: 'System',
          [`metadata.annotations.${CHOREO_ANNOTATIONS.ORGANIZATION}`]:
            organization,
        },
      });

      const deployedComponents: DeployedComponent[] = [];

      // For each project, get components and their bindings
      for (const system of systemEntities) {
        const projectName = system.metadata.name;

        // Get components in this project
        const { items: componentEntities } = await catalogApi.getEntities({
          filter: {
            kind: 'Component',
            'spec.system': projectName,
          },
        });

        // Get release bindings for each component
        for (const component of componentEntities) {
          const componentName =
            component.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT];

          if (!componentName) continue;

          try {
            const releaseBindingsData = await client.fetchReleaseBindings(
              component,
            );

            const bindings = releaseBindingsData?.data?.items;
            if (bindings && Array.isArray(bindings)) {
              // Find binding for this environment
              const binding = bindings.find(
                (b: ReleaseBinding) =>
                  b.environment?.toLowerCase() ===
                  environmentName.toLowerCase(),
              );

              if (binding) {
                const status = mapBindingStatusToStatus(binding.status);
                deployedComponents.push({
                  name: componentName,
                  displayName:
                    component.metadata.title || component.metadata.name,
                  entityRef: `component:${
                    component.metadata.namespace || 'default'
                  }/${component.metadata.name}`,
                  projectName,
                  releaseVersion: binding.releaseName || undefined,
                  status,
                  endpoints: binding.endpoints?.length || 0,
                });
              }
            }
          } catch {
            // Skip components where we can't fetch bindings
          }
        }
      }

      // Calculate status summary
      const summary: EnvironmentStatusSummary = {
        healthy: deployedComponents.filter(c => c.status === 'Ready').length,
        degraded: deployedComponents.filter(c => c.status === 'NotReady')
          .length,
        failed: deployedComponents.filter(c => c.status === 'Failed').length,
        pending: deployedComponents.filter(c => c.status === 'Pending').length,
        total: deployedComponents.length,
      };

      setComponents(deployedComponents);
      setStatusSummary(summary);
    } catch (err) {
      setError(err as Error);
      setComponents([]);
    } finally {
      setLoading(false);
    }
  }, [environmentEntity, catalogApi, client]);

  useEffect(() => {
    fetchDeployedComponents();
  }, [fetchDeployedComponents]);

  const refresh = useCallback(() => {
    fetchDeployedComponents();
  }, [fetchDeployedComponents]);

  return {
    components,
    statusSummary,
    loading,
    error,
    refresh,
  };
}

function mapBindingStatusToStatus(
  bindingStatus?: string,
): DeployedComponent['status'] {
  if (!bindingStatus) return 'Unknown';

  switch (bindingStatus.toLowerCase()) {
    case 'ready':
    case 'active':
      return 'Ready';
    case 'notready':
    case 'degraded':
      return 'NotReady';
    case 'failed':
    case 'error':
      return 'Failed';
    case 'pending':
    case 'progressing':
      return 'Pending';
    default:
      return 'Unknown';
  }
}
