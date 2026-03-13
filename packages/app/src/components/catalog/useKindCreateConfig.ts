import { useEntityList } from '@backstage/plugin-catalog-react';
import {
  useNamespacePermission,
  useProjectPermission,
  useComponentCreatePermission,
  useEnvironmentPermission,
  useDeploymentPipelinePermission,
  useComponentTypePermission,
  useClusterComponentTypePermission,
  useTraitCreatePermission,
  useClusterTraitCreatePermission,
  useWorkflowPermission,
  useClusterWorkflowPermission,
} from '@openchoreo/backstage-plugin-react';

export interface KindCreateConfig {
  createPath: string;
  buttonLabel: string;
  canCreate: boolean;
  loading: boolean;
  deniedTooltip: string;
}

export function useKindCreateConfig(): KindCreateConfig | null {
  const { filters } = useEntityList();
  const kind = filters.kind?.value?.toLowerCase();

  // Call all permission hooks unconditionally (React rules of hooks)
  const namespacePerm = useNamespacePermission();
  const projectPerm = useProjectPermission();
  const componentPerm = useComponentCreatePermission();
  const environmentPerm = useEnvironmentPermission();
  const deploymentPipelinePerm = useDeploymentPipelinePermission();
  const componentTypePerm = useComponentTypePermission();
  const clusterComponentTypePerm = useClusterComponentTypePermission();
  const traitPerm = useTraitCreatePermission();
  const clusterTraitPerm = useClusterTraitCreatePermission();
  const workflowPerm = useWorkflowPermission();
  const clusterWorkflowPerm = useClusterWorkflowPermission();

  switch (kind) {
    case 'domain':
      return {
        createPath: '/create/templates/default/create-openchoreo-namespace',
        buttonLabel: 'Create Namespace',
        canCreate: namespacePerm.canCreate,
        loading: namespacePerm.loading,
        deniedTooltip: namespacePerm.createDeniedTooltip,
      };
    case 'system':
      return {
        createPath: '/create/templates/default/create-openchoreo-project',
        buttonLabel: 'Create Project',
        canCreate: projectPerm.canCreate,
        loading: projectPerm.loading,
        deniedTooltip: projectPerm.createDeniedTooltip,
      };
    case 'component':
      return {
        createPath: '/create?view=components',
        buttonLabel: 'Create Component',
        canCreate: componentPerm.canCreate,
        loading: componentPerm.loading,
        deniedTooltip: componentPerm.createDeniedTooltip,
      };
    case 'environment':
      return {
        createPath: '/create/templates/default/create-openchoreo-environment',
        buttonLabel: 'Create Environment',
        canCreate: environmentPerm.canCreate,
        loading: environmentPerm.loading,
        deniedTooltip: environmentPerm.createDeniedTooltip,
      };
    case 'deploymentpipeline':
      return {
        createPath:
          '/create/templates/default/create-openchoreo-deploymentpipeline',
        buttonLabel: 'Create Pipeline',
        canCreate: deploymentPipelinePerm.canCreate,
        loading: deploymentPipelinePerm.loading,
        deniedTooltip: deploymentPipelinePerm.createDeniedTooltip,
      };
    case 'componenttype':
      return {
        createPath: '/create/templates/default/create-openchoreo-componenttype',
        buttonLabel: 'Create Component Type',
        canCreate: componentTypePerm.canCreate,
        loading: componentTypePerm.loading,
        deniedTooltip: componentTypePerm.createDeniedTooltip,
      };
    case 'clustercomponenttype':
      return {
        createPath:
          '/create/templates/default/create-openchoreo-clustercomponenttype',
        buttonLabel: 'Create Cluster Component Type',
        canCreate: clusterComponentTypePerm.canCreate,
        loading: clusterComponentTypePerm.loading,
        deniedTooltip: clusterComponentTypePerm.createDeniedTooltip,
      };
    case 'traittype':
      return {
        createPath: '/create/templates/default/create-openchoreo-trait',
        buttonLabel: 'Create Trait',
        canCreate: traitPerm.canCreate,
        loading: traitPerm.loading,
        deniedTooltip: traitPerm.createDeniedTooltip,
      };
    case 'clustertraittype':
      return {
        createPath: '/create/templates/default/create-openchoreo-clustertrait',
        buttonLabel: 'Create Cluster Trait',
        canCreate: clusterTraitPerm.canCreate,
        loading: clusterTraitPerm.loading,
        deniedTooltip: clusterTraitPerm.createDeniedTooltip,
      };
    case 'workflow':
      return {
        createPath:
          '/create/templates/default/create-openchoreo-componentworkflow',
        buttonLabel: 'Create Workflow',
        canCreate: workflowPerm.canCreate,
        loading: workflowPerm.loading,
        deniedTooltip: workflowPerm.createDeniedTooltip,
      };
    case 'clusterworkflow':
      return {
        createPath:
          '/create/templates/default/create-openchoreo-clusterworkflow',
        buttonLabel: 'Create Cluster Workflow',
        canCreate: clusterWorkflowPerm.canCreate,
        loading: clusterWorkflowPerm.loading,
        deniedTooltip: clusterWorkflowPerm.createDeniedTooltip,
      };
    default:
      return null;
  }
}
