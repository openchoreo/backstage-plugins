import { useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { isFromSourceComponent } from '../../../utils/componentUtils';

export type ReleaseReadinessAlertSeverity = 'error' | 'warning' | 'info';

export interface UseReleaseReadinessResult {
  loading: boolean;
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
 * Extracted from the old WorkloadButton so both the "Create release" and
 * "Edit workload" entry points share the same gating logic.
 */
export const useReleaseReadiness = (
  entity: Entity,
): UseReleaseReadinessResult => {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const client = useApi(openChoreoClientApiRef);

  const [workloadLoading, setWorkloadLoading] = useState(true);
  const [hasWorkload, setHasWorkload] = useState(false);
  const [builds, setBuilds] = useState<ModelsBuild[]>([]);
  const [buildsLoading, setBuildsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setWorkloadLoading(true);
    const fetchWorkload = async () => {
      try {
        await client.fetchWorkloadInfo(entity);
        if (!cancelled) setHasWorkload(true);
      } catch {
        if (!cancelled) setHasWorkload(false);
      } finally {
        if (!cancelled) setWorkloadLoading(false);
      }
    };
    fetchWorkload();
    return () => {
      cancelled = true;
    };
  }, [entity, client]);

  useEffect(() => {
    let cancelled = false;
    setBuildsLoading(true);
    const fetchBuilds = async () => {
      try {
        const componentName = entity.metadata.name;
        const projectName =
          entity.metadata.annotations?.['openchoreo.io/project'];
        const namespaceName =
          entity.metadata.annotations?.['openchoreo.io/namespace'];
        const baseUrl = await discovery.getBaseUrl('openchoreo');

        if (projectName && namespaceName && componentName) {
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
          const data = await response.json();
          if (!cancelled) setBuilds(data);
        }
      } catch {
        if (!cancelled) setBuilds([]);
      } finally {
        if (!cancelled) setBuildsLoading(false);
      }
    };
    fetchBuilds();
    return () => {
      cancelled = true;
    };
  }, [entity.metadata.name, entity.metadata.annotations, fetchApi, discovery]);

  const isFromSource = isFromSourceComponent(entity);
  const hasBuilds = builds.length > 0;
  const hasSuccessfulBuild = builds.some(build => !!build.image);
  const loading = workloadLoading || buildsLoading;

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
    if (isFromSource && hasSuccessfulBuild && !hasWorkload) return 'error';
    if (isFromSource && !hasBuilds) return 'warning';
    return 'info';
  })();

  return {
    loading,
    canCreateRelease,
    alertMessage,
    alertSeverity,
    hasWorkload,
    isFromSource,
  };
};
