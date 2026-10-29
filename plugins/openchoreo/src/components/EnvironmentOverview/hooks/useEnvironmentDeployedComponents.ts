import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import {
  CHOREO_ANNOTATIONS,
  toStoredReleaseLine,
} from '@openchoreo/backstage-plugin-common';
import {
  openChoreoClientApiRef,
  ReleaseBinding,
} from '../../../api/OpenChoreoClientApi';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

export interface DeployedComponent {
  name: string;
  displayName?: string;
  /** The component, or the ReleaseLine entity for a release line's deployment */
  entityRef: string;
  /** The release line deployed, absent for the main line */
  releaseLine?: string;
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
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  error: Error | null;
  refresh: () => void;
}

const EMPTY_STATUS_SUMMARY: EnvironmentStatusSummary = {
  healthy: 0,
  degraded: 0,
  failed: 0,
  pending: 0,
  total: 0,
};

export function useEnvironmentDeployedComponents(
  environmentEntity: Entity,
): UseEnvironmentDeployedComponentsResult {
  const client = useApi(openChoreoClientApiRef);
  const catalogApi = useApi(catalogApiRef);

  const environmentName =
    environmentEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.ENVIRONMENT] ||
    environmentEntity.metadata.name;
  const namespaceName =
    environmentEntity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  const { data, loading, isRefetching, error, refetch } = useOpenChoreoQuery(
    [
      'environment-deployed-components',
      stringifyEntityRef(environmentEntity),
      namespaceName,
      environmentName,
    ],
    async (): Promise<{
      components: DeployedComponent[];
      statusSummary: EnvironmentStatusSummary;
    }> => {
      // Narrows namespaceName/environmentName to string (query enabled only
      // when both are set) so catalog filters stay assignable to EntityFilterQuery.
      if (!namespaceName || !environmentName) {
        return { components: [], statusSummary: EMPTY_STATUS_SUMMARY };
      }
      // First, get all projects in this namespace
      const { items: systemEntities } = await catalogApi.getEntities({
        filter: {
          kind: 'System',
          [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]:
            namespaceName,
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
            'metadata.namespace': namespaceName,
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
              undefined,
              { allReleaseLines: true },
            );

            const bindings = releaseBindingsData?.data?.items;
            if (bindings && Array.isArray(bindings)) {
              // Each line deployed in this environment is its own row.
              const envBindings = bindings.filter(
                (b: ReleaseBinding) =>
                  b.environment?.toLowerCase() ===
                  environmentName.toLowerCase(),
              );
              const entityNamespace = component.metadata.namespace || 'default';

              for (const binding of envBindings) {
                const releaseLine = toStoredReleaseLine(binding.releaseLine);
                deployedComponents.push({
                  name: componentName,
                  displayName:
                    component.metadata.title || component.metadata.name,
                  entityRef: releaseLine
                    ? `releaseline:${entityNamespace}/${releaseLine}`
                    : `component:${entityNamespace}/${component.metadata.name}`,
                  ...(releaseLine && { releaseLine }),
                  projectName,
                  releaseVersion: binding.releaseName || undefined,
                  status: mapBindingStatusToStatus(binding.status),
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

      return { components: deployedComponents, statusSummary: summary };
    },
    { enabled: !!environmentName && !!namespaceName },
  );

  return {
    components: data?.components ?? [],
    statusSummary: data?.statusSummary ?? EMPTY_STATUS_SUMMARY,
    loading,
    isRefetching,
    error,
    refresh: refetch,
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
