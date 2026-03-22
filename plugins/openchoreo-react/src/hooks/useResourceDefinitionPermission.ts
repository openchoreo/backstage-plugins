import { useEntity } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import { usePermission } from '@backstage/plugin-permission-react';
import type {
  BasicPermission,
  ResourcePermission,
} from '@backstage/plugin-permission-common';
import {
  openchoreoComponentUpdatePermission,
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
  openchoreoWorkflowplaneUpdatePermission,
  openchoreoWorkflowplaneDeletePermission,
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
  openchoreoClusterWorkflowplaneUpdatePermission,
  openchoreoClusterWorkflowplaneDeletePermission,
  openchoreoClusterObservabilityplaneUpdatePermission,
  openchoreoClusterObservabilityplaneDeletePermission,
  openchoreoClusterWorkflowUpdatePermission,
  openchoreoClusterWorkflowDeletePermission,
  openchoreoProjectUpdatePermission,
  openchoreoNamespaceUpdatePermission,
  openchoreoNamespaceDeletePermission,
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

type PermissionEntry = {
  update: ResourcePermission | BasicPermission;
  delete: ResourcePermission | BasicPermission;
  isResourceScoped: boolean;
};

/**
 * Lookup map from entity kind (lowercase) to update/delete permissions.
 * Namespace-scoped kinds use ResourcePermission (require resourceRef).
 * Cluster-scoped kinds use BasicPermission (no resource context).
 */
const KIND_TO_PERMISSIONS: Record<string, PermissionEntry> = {
  system: {
    update: openchoreoProjectUpdatePermission,
    delete: openchoreoProjectUpdatePermission, // Projects use update permission; delete is handled separately
    isResourceScoped: true,
  },
  domain: {
    update: openchoreoNamespaceUpdatePermission,
    delete: openchoreoNamespaceDeletePermission,
    isResourceScoped: true,
  },
  component: {
    update: openchoreoComponentUpdatePermission,
    delete: openchoreoComponentUpdatePermission, // Components use update permission only; delete is not exposed in the UI
    isResourceScoped: true,
  },
  componenttype: {
    update: openchoreoComponentTypeUpdatePermission,
    delete: openchoreoComponentTypeDeletePermission,
    isResourceScoped: true,
  },
  traittype: {
    update: openchoreoTraitUpdatePermission,
    delete: openchoreoTraitDeletePermission,
    isResourceScoped: true,
  },
  workflow: {
    update: openchoreoWorkflowUpdatePermission,
    delete: openchoreoWorkflowDeletePermission,
    isResourceScoped: true,
  },
  componentworkflow: {
    update: openchoreoComponentWorkflowUpdatePermission,
    delete: openchoreoComponentWorkflowDeletePermission,
    isResourceScoped: true,
  },
  environment: {
    update: openchoreoEnvironmentUpdatePermission,
    delete: openchoreoEnvironmentDeletePermission,
    isResourceScoped: true,
  },
  dataplane: {
    update: openchoreoDataplaneUpdatePermission,
    delete: openchoreoDataplaneDeletePermission,
    isResourceScoped: true,
  },
  workflowplane: {
    update: openchoreoWorkflowplaneUpdatePermission,
    delete: openchoreoWorkflowplaneDeletePermission,
    isResourceScoped: true,
  },
  observabilityplane: {
    update: openchoreoObservabilityplaneUpdatePermission,
    delete: openchoreoObservabilityplaneDeletePermission,
    isResourceScoped: true,
  },
  deploymentpipeline: {
    update: openchoreoDeploymentpipelineUpdatePermission,
    delete: openchoreoDeploymentpipelineDeletePermission,
    isResourceScoped: true,
  },
  clustercomponenttype: {
    update: openchoreoClusterComponentTypeUpdatePermission,
    delete: openchoreoClusterComponentTypeDeletePermission,
    isResourceScoped: false,
  },
  clustertraittype: {
    update: openchoreoClusterTraitUpdatePermission,
    delete: openchoreoClusterTraitDeletePermission,
    isResourceScoped: false,
  },
  clusterdataplane: {
    update: openchoreoClusterDataplaneUpdatePermission,
    delete: openchoreoClusterDataplaneDeletePermission,
    isResourceScoped: false,
  },
  clusterworkflowplane: {
    update: openchoreoClusterWorkflowplaneUpdatePermission,
    delete: openchoreoClusterWorkflowplaneDeletePermission,
    isResourceScoped: false,
  },
  clusterobservabilityplane: {
    update: openchoreoClusterObservabilityplaneUpdatePermission,
    delete: openchoreoClusterObservabilityplaneDeletePermission,
    isResourceScoped: false,
  },
  clusterworkflow: {
    update: openchoreoClusterWorkflowUpdatePermission,
    delete: openchoreoClusterWorkflowDeletePermission,
    isResourceScoped: false,
  },
};

// Fallback permission used when kind is unsupported to satisfy React hook rules
// (hooks must always be called the same number of times).
const FALLBACK_PERMISSION = openchoreoComponentTypeUpdatePermission;

/**
 * Hook for checking if the current user has permission to update and/or delete
 * a resource definition based on the current entity's kind.
 *
 * Must be used within an EntityProvider context.
 *
 * Namespace-scoped kinds use resource-based permission checks with the entity ref.
 * Cluster-scoped kinds use basic permission checks (no resource context).
 * If the kind is not recognized, permissions default to denied.
 *
 * @example
 * ```tsx
 * const { canUpdate, canDelete, loading } = useResourceDefinitionPermission();
 *
 * if (loading) return <LoadingState />;
 *
 * return (
 *   <YamlEditor readOnly={!canUpdate} onDelete={canDelete ? handleDelete : undefined} />
 * );
 * ```
 */
export const useResourceDefinitionPermission =
  (): UseResourceDefinitionPermissionResult => {
    const { entity } = useEntity();
    const permissions = KIND_TO_PERMISSIONS[entity.kind.toLowerCase()];
    const resourceRef = stringifyEntityRef(entity);

    const updatePerm = permissions?.update ?? FALLBACK_PERMISSION;
    const deletePerm = permissions?.delete ?? FALLBACK_PERMISSION;
    const isResourceScoped = permissions?.isResourceScoped ?? true;

    // Build usePermission input based on whether the permission is resource-scoped.
    // We need to build the correct discriminated union shape for usePermission.
    const updateInput = isResourceScoped
      ? { permission: updatePerm as ResourcePermission, resourceRef }
      : { permission: updatePerm as BasicPermission };
    const deleteInput = isResourceScoped
      ? { permission: deletePerm as ResourcePermission, resourceRef }
      : { permission: deletePerm as BasicPermission };

    // Always call usePermission twice (React rules of hooks - constant call count)
    const { allowed: canUpdate, loading: updateLoading } =
      usePermission(updateInput);
    const { allowed: canDelete, loading: deleteLoading } =
      usePermission(deleteInput);

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
