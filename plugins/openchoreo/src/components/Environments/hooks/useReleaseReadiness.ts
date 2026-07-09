import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { isFromSourceComponent } from '../../../utils/componentUtils';

export type ReleaseReadinessAlertSeverity = 'error' | 'warning' | 'info';

export interface UseReleaseReadinessResult {
  loading: boolean;
  /** A background refresh is in flight while data is already on screen. */
  isRefetching: boolean;
  /** True when a release can be created (workload exists and any required build succeeded). */
  canCreateRelease: boolean;
  /** When canCreateRelease is false, a human-readable reason. */
  alertMessage: string | null;
  alertSeverity: ReleaseReadinessAlertSeverity;
  hasWorkload: boolean;
  isFromSource: boolean;
}

/**
 * Determines whether a component is ready for a new release.
 *
 * Shared gating logic so the "Create release" and "Edit workload" entry points
 * stay in sync.
 */
export const useReleaseReadiness = (
  entity: Entity,
): UseReleaseReadinessResult => {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const client = useApi(openChoreoClientApiRef);
  const entityRef = stringifyEntityRef(entity);

  // Workload existence: a successful fetch means it exists; any error means it
  // doesn't (or isn't reachable) — the same swallow-to-false the old hook did.
  const {
    data: hasWorkload = false,
    loading: workloadLoading,
    isRefetching: workloadRefetching,
  } = useOpenChoreoQuery<boolean>(
    ['release-readiness', 'workload', entityRef],
    () =>
      client
        .fetchWorkloadInfo(entity)
        .then(() => true)
        .catch(() => false),
  );

  const {
    data: builds = [],
    loading: buildsLoading,
    isRefetching: buildsRefetching,
  } = useOpenChoreoQuery<ModelsBuild[]>(
    ['release-readiness', 'builds', entityRef],
    async () => {
      const componentName = entity.metadata.name;
      const projectName =
        entity.metadata.annotations?.['openchoreo.io/project'];
      const namespaceName =
        entity.metadata.annotations?.['openchoreo.io/namespace'];
      if (!projectName || !namespaceName || !componentName) {
        return [];
      }
      const baseUrl = await discovery.getBaseUrl('openchoreo');
      try {
        const response = await fetchApi.fetch(
          `${baseUrl}/builds?componentName=${encodeURIComponent(
            componentName,
          )}&projectName=${encodeURIComponent(
            projectName,
          )}&namespaceName=${encodeURIComponent(namespaceName)}`,
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return (await response.json()) as ModelsBuild[];
      } catch {
        // Builds are best-effort for readiness — degrade to none on failure.
        return [];
      }
    },
  );

  const isFromSource = isFromSourceComponent(entity);
  const hasBuilds = builds.length > 0;
  const hasSuccessfulBuild = builds.some(build => !!build.image);
  const loading = workloadLoading || buildsLoading;
  const isRefetching = workloadRefetching || buildsRefetching;

  const canCreateRelease = (() => {
    if (loading) return false;
    if (isFromSource) {
      return hasBuilds && hasSuccessfulBuild && hasWorkload;
    }
    return hasWorkload;
  })();

  const alertMessage: string | null = (() => {
    if (loading) return null;
    if (isFromSource) {
      if (!hasBuilds) {
        return 'Build your application first to generate a container image.';
      }
      if (!hasSuccessfulBuild) {
        return 'No successful build yet. Re-run the build workflow to generate a container image.';
      }
      if (hasSuccessfulBuild && !hasWorkload) {
        return 'Workload configuration was not created automatically. Please re-run the build workflow or contact support.';
      }
    }
    if (!hasWorkload) {
      return 'Configure your workload to enable deployment.';
    }
    return null;
  })();

  const alertSeverity: ReleaseReadinessAlertSeverity = (() => {
    if (loading) return 'info';
    if (isFromSource && hasSuccessfulBuild && !hasWorkload) return 'error';
    if (isFromSource && !hasBuilds) return 'warning';
    if (isFromSource && !hasSuccessfulBuild) return 'warning';
    return 'info';
  })();

  return {
    loading,
    isRefetching,
    canCreateRelease,
    alertMessage,
    alertSeverity,
    hasWorkload,
    isFromSource,
  };
};
