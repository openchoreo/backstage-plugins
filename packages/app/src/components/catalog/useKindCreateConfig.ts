import { useRouteRef } from '@backstage/core-plugin-api';
import { scaffolderPlugin } from '@backstage/plugin-scaffolder';
import { useEntityList } from '@backstage/plugin-catalog-react';
import {
  useNamespacePermission,
  useProjectPermission,
  useComponentCreatePermission,
  useEnvironmentPermission,
  useDeploymentPipelinePermission,
  useComponentTypePermission,
  useClusterComponentTypePermission,
  useClusterResourceTypePermission,
  useResourceTypePermission,
  useClusterProjectTypePermission,
  useProjectTypePermission,
  useResourceCreatePermission,
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

  const scaffolderRoot = useRouteRef(scaffolderPlugin.routes.root)();
  const templateRoute = useRouteRef(scaffolderPlugin.routes.selectedTemplate);

  // Call all permission hooks unconditionally (React rules of hooks)
  const namespacePerm = useNamespacePermission();
  const projectPerm = useProjectPermission();
  const componentPerm = useComponentCreatePermission();
  const environmentPerm = useEnvironmentPermission();
  const deploymentPipelinePerm = useDeploymentPipelinePermission();
  const componentTypePerm = useComponentTypePermission();
  const clusterComponentTypePerm = useClusterComponentTypePermission();
  const clusterResourceTypePerm = useClusterResourceTypePermission();
  const resourceTypePerm = useResourceTypePermission();
  const clusterProjectTypePerm = useClusterProjectTypePermission();
  const projectTypePerm = useProjectTypePermission();
  const resourcePerm = useResourceCreatePermission();
  const traitPerm = useTraitCreatePermission();
  const clusterTraitPerm = useClusterTraitCreatePermission();
  const workflowPerm = useWorkflowPermission();
  const clusterWorkflowPerm = useClusterWorkflowPermission();

  switch (kind) {
    case 'domain':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-namespace',
        }),
        buttonLabel: 'Create Namespace',
        canCreate: namespacePerm.canCreate,
        loading: namespacePerm.loading,
        deniedTooltip: namespacePerm.createDeniedTooltip,
      };
    case 'system':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-project',
        }),
        buttonLabel: 'Create Project',
        canCreate: projectPerm.canCreate,
        loading: projectPerm.loading,
        deniedTooltip: projectPerm.createDeniedTooltip,
      };
    case 'component':
      return {
        createPath: `${scaffolderRoot}?view=components`,
        buttonLabel: 'Create Component',
        canCreate: componentPerm.canCreate,
        loading: componentPerm.loading,
        deniedTooltip: componentPerm.createDeniedTooltip,
      };
    case 'environment':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-environment',
        }),
        buttonLabel: 'Create Environment',
        canCreate: environmentPerm.canCreate,
        loading: environmentPerm.loading,
        deniedTooltip: environmentPerm.createDeniedTooltip,
      };
    case 'deploymentpipeline':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-deploymentpipeline',
        }),
        buttonLabel: 'Create Pipeline',
        canCreate: deploymentPipelinePerm.canCreate,
        loading: deploymentPipelinePerm.loading,
        deniedTooltip: deploymentPipelinePerm.createDeniedTooltip,
      };
    case 'componenttype':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-componenttype',
        }),
        buttonLabel: 'Create Component Type',
        canCreate: componentTypePerm.canCreate,
        loading: componentTypePerm.loading,
        deniedTooltip: componentTypePerm.createDeniedTooltip,
      };
    case 'clustercomponenttype':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-clustercomponenttype',
        }),
        buttonLabel: 'Create Cluster Component Type',
        canCreate: clusterComponentTypePerm.canCreate,
        loading: clusterComponentTypePerm.loading,
        deniedTooltip: clusterComponentTypePerm.createDeniedTooltip,
      };
    case 'clusterresourcetype':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-clusterresourcetype',
        }),
        buttonLabel: 'Create Cluster Resource Type',
        canCreate: clusterResourceTypePerm.canCreate,
        loading: clusterResourceTypePerm.loading,
        deniedTooltip: clusterResourceTypePerm.createDeniedTooltip,
      };
    case 'resourcetype':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-resourcetype',
        }),
        buttonLabel: 'Create Resource Type',
        canCreate: resourceTypePerm.canCreate,
        loading: resourceTypePerm.loading,
        deniedTooltip: resourceTypePerm.createDeniedTooltip,
      };
    case 'clusterprojecttype':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-clusterprojecttype',
        }),
        buttonLabel: 'Create Cluster Project Type',
        canCreate: clusterProjectTypePerm.canCreate,
        loading: clusterProjectTypePerm.loading,
        deniedTooltip: clusterProjectTypePerm.createDeniedTooltip,
      };
    case 'projecttype':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-projecttype',
        }),
        buttonLabel: 'Create Project Type',
        canCreate: projectTypePerm.canCreate,
        loading: projectTypePerm.loading,
        deniedTooltip: projectTypePerm.createDeniedTooltip,
      };
    case 'resource':
      return {
        createPath: `${scaffolderRoot}?view=resources`,
        buttonLabel: 'Create Resource',
        canCreate: resourcePerm.canCreate,
        loading: resourcePerm.loading,
        deniedTooltip: resourcePerm.createDeniedTooltip,
      };
    case 'traittype':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-trait',
        }),
        buttonLabel: 'Create Trait',
        canCreate: traitPerm.canCreate,
        loading: traitPerm.loading,
        deniedTooltip: traitPerm.createDeniedTooltip,
      };
    case 'clustertraittype':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-clustertrait',
        }),
        buttonLabel: 'Create Cluster Trait',
        canCreate: clusterTraitPerm.canCreate,
        loading: clusterTraitPerm.loading,
        deniedTooltip: clusterTraitPerm.createDeniedTooltip,
      };
    case 'workflow':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-componentworkflow',
        }),
        buttonLabel: 'Create Workflow',
        canCreate: workflowPerm.canCreate,
        loading: workflowPerm.loading,
        deniedTooltip: workflowPerm.createDeniedTooltip,
      };
    case 'clusterworkflow':
      return {
        createPath: templateRoute({
          namespace: 'default',
          templateName: 'create-openchoreo-clusterworkflow',
        }),
        buttonLabel: 'Create Cluster Workflow',
        canCreate: clusterWorkflowPerm.canCreate,
        loading: clusterWorkflowPerm.loading,
        deniedTooltip: clusterWorkflowPerm.createDeniedTooltip,
      };
    default:
      return null;
  }
}
