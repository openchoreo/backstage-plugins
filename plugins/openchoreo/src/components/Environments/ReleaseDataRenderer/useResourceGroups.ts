import { useMemo } from 'react';
import {
  ReleaseData,
  ReleaseResource,
  SpecResource,
  HealthStatus,
} from './types';

export interface ResourceGroup {
  kind: string;
  resources: ReleaseResource[];
  definitions: SpecResource[];
  overallHealth: HealthStatus | undefined;
}

/**
 * Hook to group release resources by kind.
 * Combines status resources and spec definitions into grouped tabs.
 */
export function useResourceGroups(data: ReleaseData['data']): ResourceGroup[] {
  return useMemo<ResourceGroup[]>(() => {
    const groups: Map<string, ResourceGroup> = new Map();
    const statusResources = data?.status?.resources || [];
    const specResources = data?.spec?.resources || [];

    // First, group status resources by kind
    statusResources.forEach(resource => {
      const kind = resource.kind;
      if (!groups.has(kind)) {
        groups.set(kind, {
          kind,
          resources: [],
          definitions: [],
          overallHealth: undefined,
        });
      }
      const group = groups.get(kind)!;
      group.resources.push(resource);

      // Determine overall health (worst status wins)
      if (resource.healthStatus) {
        if (!group.overallHealth) {
          group.overallHealth = resource.healthStatus;
        } else if (
          resource.healthStatus === 'Degraded' ||
          (resource.healthStatus === 'Suspended' &&
            group.overallHealth !== 'Degraded') ||
          (resource.healthStatus === 'Progressing' &&
            group.overallHealth === 'Healthy') ||
          (resource.healthStatus === 'Unknown' &&
            group.overallHealth === 'Healthy')
        ) {
          group.overallHealth = resource.healthStatus;
        }
      }
    });

    // Match spec resources to their kind groups
    specResources.forEach(specResource => {
      const obj = specResource.object as Record<string, unknown>;
      const kind = (obj?.kind as string) || 'Unknown';

      if (!groups.has(kind)) {
        groups.set(kind, {
          kind,
          resources: [],
          definitions: [],
          overallHealth: undefined,
        });
      }
      groups.get(kind)!.definitions.push(specResource);
    });

    return Array.from(groups.values());
  }, [data]);
}
