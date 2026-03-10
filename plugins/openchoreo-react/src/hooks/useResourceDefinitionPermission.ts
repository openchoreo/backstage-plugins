import { usePermission } from '@backstage/plugin-permission-react';
import type { BasicPermission } from '@backstage/plugin-permission-common';
import {
  openchoreoComponentTypeUpdatePermission,
  openchoreoComponentTypeDeletePermission,
  openchoreoTraitUpdatePermission,
  openchoreoTraitDeletePermission,
  openchoreoWorkflowUpdatePermission,
  openchoreoWorkflowDeletePermission,
  openchoreoComponentWorkflowUpdatePermission,
  openchoreoComponentWorkflowDeletePermission,
  openchoreoEnvironmentUpdatePermission,
  openchoreoEnvironmentDeletePermission,
  openchoreoDataplaneUpdatePermission,
  openchoreoDataplaneDeletePermission,
  openchoreoBuildplaneUpdatePermission,
  openchoreoBuildplaneDeletePermission,
  openchoreoObservabilityplaneUpdatePermission,
  openchoreoObservabilityplaneDeletePermission,
  openchoreoDeploymentpipelineUpdatePermission,
  openchoreoDeploymentpipelineDeletePermission,
  openchoreoClusterComponentTypeUpdatePermission,
  openchoreoClusterComponentTypeDeletePermission,
  openchoreoClusterTraitUpdatePermission,
  openchoreoClusterTraitDeletePermission,
  openchoreoClusterDataplaneUpdatePermission,
  openchoreoClusterDataplaneDeletePermission,
  openchoreoClusterBuildplaneUpdatePermission,
  openchoreoClusterBuildplaneDeletePermission,
  openchoreoClusterObservabilityplaneUpdatePermission,
  openchoreoClusterObservabilityplaneDeletePermission,
  openchoreoClusterWorkflowUpdatePermission,
  openchoreoClusterWorkflowDeletePermission,
} from '@openchoreo/backstage-plugin-common';

/**
 * Result of the useResourceDefinitionPermission hook.
 */
export interface UseResourceDefinitionPermissionResult {
  /** Whether the user has permission to update this resource definition */
  canUpdate: boolean;
  /** Whether the user has permission to delete this resource definition */
  canDelete: boolean;
  /** Whether any permission check is still loading */
  loading: boolean;
  /** Tooltip message when update permission is denied (empty string when allowed/loading) */
  updateDeniedTooltip: string;
  /** Tooltip message when delete permission is denied (empty string when allowed/loading) */
  deleteDeniedTooltip: string;
}

/**
 * Lookup map from entity kind (lowercase) to update/delete permissions.
 */
const KIND_TO_PERMISSIONS: Record<
  string,
  { update: BasicPermission; delete: BasicPermission }
> = {
  componenttype: {
    update: openchoreoComponentTypeUpdatePermission,
    delete: openchoreoComponentTypeDeletePermission,
  },
  traittype: {
    update: openchoreoTraitUpdatePermission,
    delete: openchoreoTraitDeletePermission,
  },
  workflow: {
    update: openchoreoWorkflowUpdatePermission,
    delete: openchoreoWorkflowDeletePermission,
  },
  componentworkflow: {
    update: openchoreoComponentWorkflowUpdatePermission,
    delete: openchoreoComponentWorkflowDeletePermission,
  },
  environment: {
    update: openchoreoEnvironmentUpdatePermission,
    delete: openchoreoEnvironmentDeletePermission,
  },
  dataplane: {
    update: openchoreoDataplaneUpdatePermission,
    delete: openchoreoDataplaneDeletePermission,
  },
  buildplane: {
    update: openchoreoBuildplaneUpdatePermission,
    delete: openchoreoBuildplaneDeletePermission,
  },
  observabilityplane: {
    update: openchoreoObservabilityplaneUpdatePermission,
    delete: openchoreoObservabilityplaneDeletePermission,
  },
  deploymentpipeline: {
    update: openchoreoDeploymentpipelineUpdatePermission,
    delete: openchoreoDeploymentpipelineDeletePermission,
  },
  clustercomponenttype: {
    update: openchoreoClusterComponentTypeUpdatePermission,
    delete: openchoreoClusterComponentTypeDeletePermission,
  },
  clustertraittype: {
    update: openchoreoClusterTraitUpdatePermission,
    delete: openchoreoClusterTraitDeletePermission,
  },
  clusterdataplane: {
    update: openchoreoClusterDataplaneUpdatePermission,
    delete: openchoreoClusterDataplaneDeletePermission,
  },
  clusterbuildplane: {
    update: openchoreoClusterBuildplaneUpdatePermission,
    delete: openchoreoClusterBuildplaneDeletePermission,
  },
  clusterobservabilityplane: {
    update: openchoreoClusterObservabilityplaneUpdatePermission,
    delete: openchoreoClusterObservabilityplaneDeletePermission,
  },
  clusterworkflow: {
    update: openchoreoClusterWorkflowUpdatePermission,
    delete: openchoreoClusterWorkflowDeletePermission,
  },
};

// Fallback permission used when kind is unsupported to satisfy React hook rules
// (hooks must always be called the same number of times).
const FALLBACK_PERMISSION = openchoreoComponentTypeUpdatePermission;

/**
 * Hook for checking if the current user has permission to update and/or delete
 * a resource definition based on its entity kind.
 *
 * This is an org-level permission check (no resource context required).
 * If the kind is not recognized, permissions default to denied.
 *
 * @param entityKind - The Backstage entity kind (e.g. 'ComponentType', 'TraitType')
 *
 * @example
 * ```tsx
 * const { canUpdate, canDelete, loading } = useResourceDefinitionPermission(entity.kind);
 *
 * if (loading) return <LoadingState />;
 *
 * return (
 *   <YamlEditor readOnly={!canUpdate} onDelete={canDelete ? handleDelete : undefined} />
 * );
 * ```
 */
export const useResourceDefinitionPermission = (
  entityKind: string,
): UseResourceDefinitionPermissionResult => {
  const permissions = KIND_TO_PERMISSIONS[entityKind.toLowerCase()];

  // Always call usePermission twice (React rules of hooks - constant call count)
  const { allowed: canUpdate, loading: updateLoading } = usePermission({
    permission: permissions?.update ?? FALLBACK_PERMISSION,
  });
  const { allowed: canDelete, loading: deleteLoading } = usePermission({
    permission: permissions?.delete ?? FALLBACK_PERMISSION,
  });

  // If kind not in map, deny by default
  const effectiveCanUpdate = permissions ? canUpdate : false;
  const effectiveCanDelete = permissions ? canDelete : false;
  const loading = updateLoading || deleteLoading;

  return {
    canUpdate: effectiveCanUpdate,
    canDelete: effectiveCanDelete,
    loading,
    updateDeniedTooltip:
      !effectiveCanUpdate && !loading
        ? 'You do not have permission to edit this resource'
        : '',
    deleteDeniedTooltip:
      !effectiveCanDelete && !loading
        ? 'You do not have permission to delete this resource'
        : '',
  };
};
