import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Resource type identifiers for OpenChoreo entities.
 * Used for resource-based permission checks.
 */
export const OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE =
  'openchoreo-namespaced-resource';
export const OPENCHOREO_RESOURCE_TYPE_PROJECT = 'openchoreo-project';

/**
 * Permission to create a new component.
 * Requires organization and project context.
 */
export const openchoreoComponentCreatePermission = createPermission({
  name: 'openchoreo.component.create',
  attributes: { action: 'create' },
});

/**
 * Permission to read/view a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoComponentReadPermission = createPermission({
  name: 'openchoreo.component.read',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to trigger a build for a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoComponentBuildPermission = createPermission({
  name: 'openchoreo.component.build',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to view builds of a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoComponentViewBuildsPermission = createPermission({
  name: 'openchoreo.component.viewbuilds',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to create a release binding (deploy a component to an environment).
 * Resource-based: requires the specific component context.
 */
export const openchoreoReleaseBindingCreatePermission = createPermission({
  name: 'openchoreo.releasebinding.create',
  attributes: { action: 'create' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update component configuration (traits, workload, etc.).
 * Resource-based: requires the specific component context.
 */
export const openchoreoComponentUpdatePermission = createPermission({
  name: 'openchoreo.component.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update workload configuration.
 * Resource-based: requires the specific component context.
 */
export const openchoreoWorkloadUpdatePermission = createPermission({
  name: 'openchoreo.workload.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to create a new project.
 * Requires organization context.
 */
export const openchoreoProjectCreatePermission = createPermission({
  name: 'openchoreo.project.create',
  attributes: { action: 'create' },
});

/**
 * Scoped permission to create a component within a specific project/namespace.
 * Resource-based: evaluates deny paths against entity scope.
 * Use on project pages where entity context is available.
 */
export const openchoreoComponentCreateScopedPermission = createPermission({
  name: 'openchoreo.component.create.scoped',
  attributes: { action: 'create' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Scoped permission to create a project within a specific namespace.
 * Resource-based: evaluates deny paths against entity scope.
 * Use on namespace pages where entity context is available.
 */
export const openchoreoProjectCreateScopedPermission = createPermission({
  name: 'openchoreo.project.create.scoped',
  attributes: { action: 'create' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to read/view a project.
 * Resource-based: requires the specific project context.
 */
export const openchoreoProjectReadPermission = createPermission({
  name: 'openchoreo.project.read',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_PROJECT,
});

/**
 * Permission to update a project.
 * Resource-based: requires the specific project context.
 */
export const openchoreoProjectUpdatePermission = createPermission({
  name: 'openchoreo.project.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_PROJECT,
});

/**
 * Permission to read/view namespace details.
 * Namespace-scoped permission.
 */
export const openchoreoNamespaceReadPermission = createPermission({
  name: 'openchoreo.namespace.read',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new environment.
 * Requires organization context.
 */
export const openchoreoEnvironmentCreatePermission = createPermission({
  name: 'openchoreo.environment.create',
  attributes: { action: 'create' },
});

/**
 * Permission to read/view environments.
 * Org-scoped permission.
 */
export const openchoreoEnvironmentReadPermission = createPermission({
  name: 'openchoreo.environment.read',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new notification channel.
 * Requires organization context.
 */
export const openchoreoNotificationChannelCreatePermission = createPermission({
  name: 'openchoreo.notificationchannel.create',
  attributes: { action: 'create' },
});

/**
 * Permission to read/view notification channels.
 * Org-scoped permission.
 */
export const openchoreoNotificationChannelReadPermission = createPermission({
  name: 'openchoreo.notificationchannel.read',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new namespace (organization).
 * Requires organization context.
 */
export const openchoreoNamespaceCreatePermission = createPermission({
  name: 'openchoreo.namespace.create',
  attributes: { action: 'create' },
});

/**
 * Permission to update a namespace.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoNamespaceUpdatePermission = createPermission({
  name: 'openchoreo.namespace.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a namespace.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoNamespaceDeletePermission = createPermission({
  name: 'openchoreo.namespace.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to create a new trait.
 * Requires organization context.
 */
export const openchoreoTraitCreatePermission = createPermission({
  name: 'openchoreo.trait.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new component type.
 * Requires organization context.
 */
export const openchoreoComponentTypeCreatePermission = createPermission({
  name: 'openchoreo.componenttype.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new resource type.
 * Requires organization context.
 */
export const openchoreoResourceTypeCreatePermission = createPermission({
  name: 'openchoreo.resourcetype.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new project type.
 * Requires organization context.
 */
export const openchoreoProjectTypeCreatePermission = createPermission({
  name: 'openchoreo.projecttype.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new resource (developer-facing managed
 * infrastructure dependency). Project context resolved server-side.
 */
export const openchoreoResourceCreatePermission = createPermission({
  name: 'openchoreo.resource.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new cluster component type.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterComponentTypeCreatePermission = createPermission({
  name: 'openchoreo.clustercomponenttype.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new cluster resource type.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterResourceTypeCreatePermission = createPermission({
  name: 'openchoreo.clusterresourcetype.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new cluster project type.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterProjectTypeCreatePermission = createPermission({
  name: 'openchoreo.clusterprojecttype.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new cluster trait.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterTraitCreatePermission = createPermission({
  name: 'openchoreo.clustertrait.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new workflow.
 * Requires organization context.
 */
export const openchoreoWorkflowCreatePermission = createPermission({
  name: 'openchoreo.workflow.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new cluster workflow.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterWorkflowCreatePermission = createPermission({
  name: 'openchoreo.clusterworkflow.create',
  attributes: { action: 'create' },
});

/**
 * Permission to create a new component workflow.
 * Requires organization context.
 */
export const openchoreoComponentWorkflowCreatePermission = createPermission({
  name: 'openchoreo.componentworkflow.create',
  attributes: { action: 'create' },
});

// --- Update & Delete permissions for resource definition kinds ---

/**
 * Permission to update a component type.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoComponentTypeUpdatePermission = createPermission({
  name: 'openchoreo.componenttype.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a component type.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoComponentTypeDeletePermission = createPermission({
  name: 'openchoreo.componenttype.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update a resource type.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoResourceTypeUpdatePermission = createPermission({
  name: 'openchoreo.resourcetype.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a resource type.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoResourceTypeDeletePermission = createPermission({
  name: 'openchoreo.resourcetype.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update a project type.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoProjectTypeUpdatePermission = createPermission({
  name: 'openchoreo.projecttype.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a project type.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoProjectTypeDeletePermission = createPermission({
  name: 'openchoreo.projecttype.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update a resource.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoResourceUpdatePermission = createPermission({
  name: 'openchoreo.resource.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a resource.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoResourceDeletePermission = createPermission({
  name: 'openchoreo.resource.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update a trait.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoTraitUpdatePermission = createPermission({
  name: 'openchoreo.trait.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a trait.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoTraitDeletePermission = createPermission({
  name: 'openchoreo.trait.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update a workflow.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoWorkflowUpdatePermission = createPermission({
  name: 'openchoreo.workflow.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a workflow.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoWorkflowDeletePermission = createPermission({
  name: 'openchoreo.workflow.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update a component workflow.
 * Resource-based: requires the specific entity context.
 */
export const openchoreoComponentWorkflowUpdatePermission = createPermission({
  name: 'openchoreo.componentworkflow.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a component workflow.
 * Resource-based: requires entity context.
 */
export const openchoreoComponentWorkflowDeletePermission = createPermission({
  name: 'openchoreo.componentworkflow.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update an environment.
 * Resource-based: requires entity context.
 */
export const openchoreoEnvironmentUpdatePermission = createPermission({
  name: 'openchoreo.environment.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete an environment.
 * Resource-based: requires entity context.
 */
export const openchoreoEnvironmentDeletePermission = createPermission({
  name: 'openchoreo.environment.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update a notification channel.
 * Resource-based: requires entity context.
 */
export const openchoreoNotificationChannelUpdatePermission = createPermission({
  name: 'openchoreo.notificationchannel.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a notification channel.
 * Resource-based: requires entity context.
 */
export const openchoreoNotificationChannelDeletePermission = createPermission({
  name: 'openchoreo.notificationchannel.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update a dataplane.
 * Resource-based: requires entity context.
 */
export const openchoreoDataplaneUpdatePermission = createPermission({
  name: 'openchoreo.dataplane.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a dataplane.
 * Resource-based: requires entity context.
 */
export const openchoreoDataplaneDeletePermission = createPermission({
  name: 'openchoreo.dataplane.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update a workflowplane.
 * Resource-based: requires entity context.
 */
export const openchoreoWorkflowplaneUpdatePermission = createPermission({
  name: 'openchoreo.workflowplane.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a workflowplane.
 * Resource-based: requires entity context.
 */
export const openchoreoWorkflowplaneDeletePermission = createPermission({
  name: 'openchoreo.workflowplane.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update an observability plane.
 * Resource-based: requires entity context.
 */
export const openchoreoObservabilityplaneUpdatePermission = createPermission({
  name: 'openchoreo.observabilityplane.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete an observability plane.
 * Resource-based: requires entity context.
 */
export const openchoreoObservabilityplaneDeletePermission = createPermission({
  name: 'openchoreo.observabilityplane.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to create a new deployment pipeline.
 * Org-scoped permission (no resource context required).
 */
export const openchoreoDeploymentpipelineCreatePermission = createPermission({
  name: 'openchoreo.deploymentpipeline.create',
  attributes: { action: 'create' },
});

/**
 * Permission to update a deployment pipeline.
 * Resource-based: requires entity context.
 */
export const openchoreoDeploymentpipelineUpdatePermission = createPermission({
  name: 'openchoreo.deploymentpipeline.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a deployment pipeline.
 * Resource-based: requires entity context.
 */
export const openchoreoDeploymentpipelineDeletePermission = createPermission({
  name: 'openchoreo.deploymentpipeline.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to update a cluster component type.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterComponentTypeUpdatePermission = createPermission({
  name: 'openchoreo.clustercomponenttype.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a cluster component type.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterComponentTypeDeletePermission = createPermission({
  name: 'openchoreo.clustercomponenttype.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to update a cluster resource type.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterResourceTypeUpdatePermission = createPermission({
  name: 'openchoreo.clusterresourcetype.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a cluster resource type.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterResourceTypeDeletePermission = createPermission({
  name: 'openchoreo.clusterresourcetype.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to update a cluster project type.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterProjectTypeUpdatePermission = createPermission({
  name: 'openchoreo.clusterprojecttype.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a cluster project type.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterProjectTypeDeletePermission = createPermission({
  name: 'openchoreo.clusterprojecttype.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to update a cluster trait.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterTraitUpdatePermission = createPermission({
  name: 'openchoreo.clustertrait.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a cluster trait.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterTraitDeletePermission = createPermission({
  name: 'openchoreo.clustertrait.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to update a cluster dataplane.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterDataplaneUpdatePermission = createPermission({
  name: 'openchoreo.clusterdataplane.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a cluster dataplane.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterDataplaneDeletePermission = createPermission({
  name: 'openchoreo.clusterdataplane.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to update a cluster workflowplane.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterWorkflowplaneUpdatePermission = createPermission({
  name: 'openchoreo.clusterworkflowplane.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a cluster workflowplane.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterWorkflowplaneDeletePermission = createPermission({
  name: 'openchoreo.clusterworkflowplane.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to update a cluster observability plane.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterObservabilityplaneUpdatePermission =
  createPermission({
    name: 'openchoreo.clusterobservabilityplane.update',
    attributes: { action: 'update' },
  });

/**
 * Permission to delete a cluster observability plane.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterObservabilityplaneDeletePermission =
  createPermission({
    name: 'openchoreo.clusterobservabilityplane.delete',
    attributes: { action: 'delete' },
  });

/**
 * Permission to update a cluster workflow.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterWorkflowUpdatePermission = createPermission({
  name: 'openchoreo.clusterworkflow.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a cluster workflow.
 * Cluster-scoped permission (no namespace context required).
 */
export const openchoreoClusterWorkflowDeletePermission = createPermission({
  name: 'openchoreo.clusterworkflow.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to create a new component release.
 * Requires component context.
 */
export const openchoreoReleaseCreatePermission = createPermission({
  name: 'openchoreo.release.create',
  attributes: { action: 'create' },
});

/**
 * Permission to read/view component releases.
 * Org-scoped permission.
 */
export const openchoreoReleaseReadPermission = createPermission({
  name: 'openchoreo.release.read',
  attributes: { action: 'read' },
});

/**
 * Permission to update a release binding (e.g., undeploy a component from an environment).
 * Resource-based: requires the specific component context.
 */
export const openchoreoReleaseBindingUpdatePermission = createPermission({
  name: 'openchoreo.releasebinding.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to delete a release binding (i.e., remove a deployment from an
 * environment). Resource-based — gates the per-env "Remove deployment" button.
 */
export const openchoreoReleaseBindingDeletePermission = createPermission({
  name: 'openchoreo.releasebinding.delete',
  attributes: { action: 'delete' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to read/view release bindings.
 * Org-scoped permission.
 */
export const openchoreoReleaseBindingReadPermission = createPermission({
  name: 'openchoreo.releasebinding.read',
  attributes: { action: 'read' },
});

/**
 * Permission to update a ResourceReleaseBinding (e.g., promote to a newer
 * ResourceRelease, toggle retainPolicy). Resource-scoped: requires the
 * specific Resource entity context. Independent of the component-side
 * release-binding permissions so a PE can grant resource-only authority
 * without also granting component-binding authority.
 */
export const openchoreoResourceReleaseBindingUpdatePermission =
  createPermission({
    name: 'openchoreo.resourcereleasebinding.update',
    attributes: { action: 'update' },
    resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
  });

/**
 * Permission to create a ResourceReleaseBinding (i.e., deploy a Resource to
 * an environment for the first time). Resource-scoped on the consuming
 * Resource entity.
 */
export const openchoreoResourceReleaseBindingCreatePermission =
  createPermission({
    name: 'openchoreo.resourcereleasebinding.create',
    attributes: { action: 'create' },
    resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
  });

/**
 * Permission to delete a ResourceReleaseBinding (i.e., undeploy a Resource
 * from an environment). The Resource controller's PV-style finalizer honours
 * `spec.retainPolicy=Retain` and may keep DP-side state alive even after the
 * binding is removed; the UI surfaces this explicitly in its confirm dialog.
 */
export const openchoreoResourceReleaseBindingDeletePermission =
  createPermission({
    name: 'openchoreo.resourcereleasebinding.delete',
    attributes: { action: 'delete' },
    resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
  });

/**
 * Resource-scoped variant of the release-binding view permission. Used by
 * per-env hooks so ABAC `resource.environment` constraints on
 * `releasebinding:view` can hide the body of individual env cards even
 * when the org-level read permission is allowed.
 */
export const openchoreoReleaseBindingViewPermission = createPermission({
  name: 'openchoreo.releasebinding.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to view roles.
 * Org-scoped permission.
 */
export const openchoreoRoleViewPermission = createPermission({
  name: 'openchoreo.role.view',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new role.
 * Org-scoped permission.
 */
export const openchoreoRoleCreatePermission = createPermission({
  name: 'openchoreo.role.create',
  attributes: { action: 'create' },
});

/**
 * Permission to update an existing role.
 * Org-scoped permission.
 */
export const openchoreoRoleUpdatePermission = createPermission({
  name: 'openchoreo.role.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a role.
 * Org-scoped permission.
 */
export const openchoreoRoleDeletePermission = createPermission({
  name: 'openchoreo.role.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to view cluster roles.
 * Org-scoped permission.
 */
export const openchoreoClusterRoleViewPermission = createPermission({
  name: 'openchoreo.clusterrole.view',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new cluster role.
 * Org-scoped permission.
 */
export const openchoreoClusterRoleCreatePermission = createPermission({
  name: 'openchoreo.clusterrole.create',
  attributes: { action: 'create' },
});

/**
 * Permission to update an existing cluster role.
 * Org-scoped permission.
 */
export const openchoreoClusterRoleUpdatePermission = createPermission({
  name: 'openchoreo.clusterrole.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a cluster role.
 * Org-scoped permission.
 */
export const openchoreoClusterRoleDeletePermission = createPermission({
  name: 'openchoreo.clusterrole.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to view role bindings.
 * Org-scoped permission.
 */
export const openchoreoRoleMappingViewPermission = createPermission({
  name: 'openchoreo.rolemapping.view',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new role mapping.
 * Org-scoped permission.
 */
export const openchoreoRoleMappingCreatePermission = createPermission({
  name: 'openchoreo.rolemapping.create',
  attributes: { action: 'create' },
});

/**
 * Permission to update an existing role mapping.
 * Org-scoped permission.
 */
export const openchoreoRoleMappingUpdatePermission = createPermission({
  name: 'openchoreo.rolemapping.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a role mapping.
 * Org-scoped permission.
 */
export const openchoreoRoleMappingDeletePermission = createPermission({
  name: 'openchoreo.rolemapping.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to view cluster role bindings.
 * Org-scoped permission.
 */
export const openchoreoClusterRoleMappingViewPermission = createPermission({
  name: 'openchoreo.clusterrolemapping.view',
  attributes: { action: 'read' },
});

/**
 * Permission to create a new cluster role mapping.
 * Org-scoped permission.
 */
export const openchoreoClusterRoleMappingCreatePermission = createPermission({
  name: 'openchoreo.clusterrolemapping.create',
  attributes: { action: 'create' },
});

/**
 * Permission to update an existing cluster role mapping.
 * Org-scoped permission.
 */
export const openchoreoClusterRoleMappingUpdatePermission = createPermission({
  name: 'openchoreo.clusterrolemapping.update',
  attributes: { action: 'update' },
});

/**
 * Permission to delete a cluster role mapping.
 * Org-scoped permission.
 */
export const openchoreoClusterRoleMappingDeletePermission = createPermission({
  name: 'openchoreo.clusterrolemapping.delete',
  attributes: { action: 'delete' },
});

/**
 * Permission to exec into a running pod for a component.
 * Resource-based: requires the specific component context.
 * Supports ABAC environment constraints (e.g. restrict to non-production).
 */
export const openchoreoExecPermission = createPermission({
  name: 'openchoreo.exec',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to view logs for a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoLogsViewPermission = createPermission({
  name: 'openchoreo.logs.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to view Kubernetes events for a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoEventsViewPermission = createPermission({
  name: 'openchoreo.events.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to view metrics for a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoMetricsViewPermission = createPermission({
  name: 'openchoreo.metrics.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to view traces for a project.
 * Resource-based: requires the specific project context.
 */
export const openchoreoTracesViewPermission = createPermission({
  name: 'openchoreo.traces.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_PROJECT,
});

/**
 * Permission to view RCA reports for a project.
 * Resource-based: requires the specific project context.
 */
export const openchoreoRcaViewPermission = createPermission({
  name: 'openchoreo.rca.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_PROJECT,
});

/**
 * Permission to update RCA reports for a project (apply/dismiss fixes).
 * Resource-based: requires the specific project context.
 */
export const openchoreoRcaUpdatePermission = createPermission({
  name: 'openchoreo.rca.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_PROJECT,
});

/**
 * Permission to update FinOps reports for a project (apply/dismiss recommendations).
 * Resource-based: requires the specific project context.
 */
export const openchoreoFinopsUpdatePermission = createPermission({
  name: 'openchoreo.finops.update',
  attributes: { action: 'update' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_PROJECT,
});

/**
 * Permission to view traits for a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoTraitsViewPermission = createPermission({
  name: 'openchoreo.traits.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to view alerts for a component.
 * Resource-based: requires the specific component context.
 */
export const openchoreoAlertsViewPermission = createPermission({
  name: 'openchoreo.alerts.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to view Cilium Hubble wirelogs for a project/component.
 * Resource-based: scoped to the component's namespaced resource so the
 * tab is gated alongside Logs/Metrics/Alerts on the component page.
 */
export const openchoreoWirelogsViewPermission = createPermission({
  name: 'openchoreo.wirelogs.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * Permission to view incidents for a project.
 * Resource-based: requires the specific project context.
 */
export const openchoreoIncidentsViewPermission = createPermission({
  name: 'openchoreo.incidents.view',
  attributes: { action: 'read' },
  resourceType: OPENCHOREO_RESOURCE_TYPE_NAMESPACED_RESOURCE,
});

/**
 * All OpenChoreo permissions exported as an array.
 * Useful for registering all permissions with the permission framework.
 */
export const openchoreoPermissions = [
  openchoreoComponentCreatePermission,
  openchoreoComponentReadPermission,
  openchoreoComponentBuildPermission,
  openchoreoComponentViewBuildsPermission,
  openchoreoReleaseBindingCreatePermission,
  openchoreoComponentUpdatePermission,
  openchoreoWorkloadUpdatePermission,
  openchoreoProjectCreatePermission,
  openchoreoProjectReadPermission,
  openchoreoProjectUpdatePermission,
  openchoreoNamespaceReadPermission,
  openchoreoNamespaceCreatePermission,
  openchoreoNamespaceUpdatePermission,
  openchoreoNamespaceDeletePermission,
  openchoreoEnvironmentCreatePermission,
  openchoreoEnvironmentReadPermission,
  openchoreoNotificationChannelCreatePermission,
  openchoreoNotificationChannelReadPermission,
  openchoreoReleaseCreatePermission,
  openchoreoReleaseReadPermission,
  openchoreoReleaseBindingReadPermission,
  openchoreoReleaseBindingViewPermission,
  openchoreoReleaseBindingUpdatePermission,
  openchoreoReleaseBindingDeletePermission,
  openchoreoResourceReleaseBindingUpdatePermission,
  openchoreoResourceReleaseBindingCreatePermission,
  openchoreoResourceReleaseBindingDeletePermission,
  openchoreoRoleViewPermission,
  openchoreoRoleCreatePermission,
  openchoreoRoleUpdatePermission,
  openchoreoRoleDeletePermission,
  openchoreoClusterRoleViewPermission,
  openchoreoClusterRoleCreatePermission,
  openchoreoClusterRoleUpdatePermission,
  openchoreoClusterRoleDeletePermission,
  openchoreoRoleMappingViewPermission,
  openchoreoRoleMappingCreatePermission,
  openchoreoRoleMappingUpdatePermission,
  openchoreoRoleMappingDeletePermission,
  openchoreoClusterRoleMappingViewPermission,
  openchoreoClusterRoleMappingCreatePermission,
  openchoreoClusterRoleMappingUpdatePermission,
  openchoreoClusterRoleMappingDeletePermission,
  openchoreoExecPermission,
  openchoreoLogsViewPermission,
  openchoreoEventsViewPermission,
  openchoreoMetricsViewPermission,
  openchoreoTracesViewPermission,
  openchoreoRcaViewPermission,
  openchoreoRcaUpdatePermission,
  openchoreoFinopsUpdatePermission,
  openchoreoTraitsViewPermission,
  openchoreoAlertsViewPermission,
  openchoreoWirelogsViewPermission,
  openchoreoIncidentsViewPermission,
  openchoreoTraitCreatePermission,
  openchoreoComponentTypeCreatePermission,
  openchoreoResourceTypeCreatePermission,
  openchoreoProjectTypeCreatePermission,
  openchoreoResourceCreatePermission,
  openchoreoClusterComponentTypeCreatePermission,
  openchoreoClusterResourceTypeCreatePermission,
  openchoreoClusterProjectTypeCreatePermission,
  openchoreoClusterTraitCreatePermission,
  openchoreoWorkflowCreatePermission,
  openchoreoClusterWorkflowCreatePermission,
  openchoreoComponentWorkflowCreatePermission,
  openchoreoDeploymentpipelineCreatePermission,
  // Update & Delete permissions for resource definition kinds
  openchoreoComponentTypeUpdatePermission,
  openchoreoComponentTypeDeletePermission,
  openchoreoResourceTypeUpdatePermission,
  openchoreoResourceTypeDeletePermission,
  openchoreoProjectTypeUpdatePermission,
  openchoreoProjectTypeDeletePermission,
  openchoreoResourceUpdatePermission,
  openchoreoResourceDeletePermission,
  openchoreoTraitUpdatePermission,
  openchoreoTraitDeletePermission,
  openchoreoWorkflowUpdatePermission,
  openchoreoWorkflowDeletePermission,
  openchoreoComponentWorkflowUpdatePermission,
  openchoreoComponentWorkflowDeletePermission,
  openchoreoEnvironmentUpdatePermission,
  openchoreoEnvironmentDeletePermission,
  openchoreoNotificationChannelUpdatePermission,
  openchoreoNotificationChannelDeletePermission,
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
  openchoreoClusterResourceTypeUpdatePermission,
  openchoreoClusterResourceTypeDeletePermission,
  openchoreoClusterProjectTypeUpdatePermission,
  openchoreoClusterProjectTypeDeletePermission,
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
  // Scoped create permissions (for entity-context pages)
  openchoreoComponentCreateScopedPermission,
  openchoreoProjectCreateScopedPermission,
];

/**
 * Mapping from OpenChoreo permission names to OpenChoreo API action names.
 * Used by the permission policy to translate Backstage permission checks
 * to OpenChoreo capability checks.
 */
export const OPENCHOREO_PERMISSION_TO_ACTION: Record<string, string> = {
  'openchoreo.component.create': 'component:create',
  'openchoreo.component.read': 'component:view',
  'openchoreo.component.update': 'component:update',
  'openchoreo.workload.update': 'workload:update',
  'openchoreo.component.build': 'workflowrun:create',
  'openchoreo.component.viewbuilds': 'workflowrun:view',
  'openchoreo.releasebinding.create': 'releasebinding:create',
  'openchoreo.project.create': 'project:create',
  'openchoreo.component.create.scoped': 'component:create',
  'openchoreo.project.create.scoped': 'project:create',
  'openchoreo.project.read': 'project:view',
  'openchoreo.project.update': 'project:update',
  'openchoreo.namespace.read': 'namespace:view',
  'openchoreo.namespace.create': 'namespace:create',
  'openchoreo.namespace.update': 'namespace:update',
  'openchoreo.namespace.delete': 'namespace:delete',
  'openchoreo.environment.create': 'environment:create',
  'openchoreo.environment.read': 'environment:view',
  'openchoreo.notificationchannel.create':
    'observabilityalertsnotificationchannel:create',
  'openchoreo.notificationchannel.read':
    'observabilityalertsnotificationchannel:view',
  'openchoreo.release.create': 'componentrelease:create',
  'openchoreo.release.read': 'componentrelease:view',
  'openchoreo.releasebinding.update': 'releasebinding:update',
  'openchoreo.releasebinding.delete': 'releasebinding:delete',
  'openchoreo.releasebinding.read': 'releasebinding:view',
  'openchoreo.releasebinding.view': 'releasebinding:view',
  'openchoreo.resourcereleasebinding.update': 'resourcereleasebinding:update',
  'openchoreo.resourcereleasebinding.create': 'resourcereleasebinding:create',
  'openchoreo.resourcereleasebinding.delete': 'resourcereleasebinding:delete',
  'openchoreo.role.view': 'authzrole:view',
  'openchoreo.role.create': 'authzrole:create',
  'openchoreo.role.update': 'authzrole:update',
  'openchoreo.role.delete': 'authzrole:delete',
  'openchoreo.clusterrole.view': 'clusterauthzrole:view',
  'openchoreo.clusterrole.create': 'clusterauthzrole:create',
  'openchoreo.clusterrole.update': 'clusterauthzrole:update',
  'openchoreo.clusterrole.delete': 'clusterauthzrole:delete',
  'openchoreo.rolemapping.view': 'authzrolebinding:view',
  'openchoreo.rolemapping.create': 'authzrolebinding:create',
  'openchoreo.rolemapping.update': 'authzrolebinding:update',
  'openchoreo.rolemapping.delete': 'authzrolebinding:delete',
  'openchoreo.clusterrolemapping.view': 'clusterauthzrolebinding:view',
  'openchoreo.clusterrolemapping.create': 'clusterauthzrolebinding:create',
  'openchoreo.clusterrolemapping.update': 'clusterauthzrolebinding:update',
  'openchoreo.clusterrolemapping.delete': 'clusterauthzrolebinding:delete',
  'openchoreo.exec': 'component:exec',
  'openchoreo.logs.view': 'logs:view',
  'openchoreo.events.view': 'events:view',
  'openchoreo.alerts.view': 'alerts:view',
  'openchoreo.wirelogs.view': 'wirelogs:view',
  'openchoreo.incidents.view': 'incidents:view',
  'openchoreo.metrics.view': 'metrics:view',
  'openchoreo.traces.view': 'traces:view',
  'openchoreo.rca.view': 'rcareport:view',
  'openchoreo.rca.update': 'rcareport:update',
  'openchoreo.finops.update': 'finopsreport:update',
  'openchoreo.traits.view': 'trait:view',
  'openchoreo.trait.create': 'trait:create',
  'openchoreo.componenttype.create': 'componenttype:create',
  'openchoreo.resourcetype.create': 'resourcetype:create',
  'openchoreo.resource.create': 'resource:create',
  'openchoreo.workflow.create': 'workflow:create',
  'openchoreo.clusterworkflow.create': 'clusterworkflow:create',
  'openchoreo.componentworkflow.create': 'workflow:create',
  'openchoreo.clustercomponenttype.create': 'clustercomponenttype:create',
  'openchoreo.clusterresourcetype.create': 'clusterresourcetype:create',
  'openchoreo.projecttype.create': 'projecttype:create',
  'openchoreo.clusterprojecttype.create': 'clusterprojecttype:create',
  'openchoreo.clustertrait.create': 'clustertrait:create',
  // Update & Delete actions for resource definition kinds
  'openchoreo.componenttype.update': 'componenttype:update',
  'openchoreo.componenttype.delete': 'componenttype:delete',
  'openchoreo.resourcetype.update': 'resourcetype:update',
  'openchoreo.resourcetype.delete': 'resourcetype:delete',
  'openchoreo.projecttype.update': 'projecttype:update',
  'openchoreo.projecttype.delete': 'projecttype:delete',
  'openchoreo.resource.update': 'resource:update',
  'openchoreo.resource.delete': 'resource:delete',
  'openchoreo.trait.update': 'trait:update',
  'openchoreo.trait.delete': 'trait:delete',
  'openchoreo.workflow.update': 'workflow:update',
  'openchoreo.workflow.delete': 'workflow:delete',
  'openchoreo.componentworkflow.update': 'workflow:update',
  'openchoreo.componentworkflow.delete': 'workflow:delete',
  'openchoreo.environment.update': 'environment:update',
  'openchoreo.environment.delete': 'environment:delete',
  'openchoreo.notificationchannel.update':
    'observabilityalertsnotificationchannel:update',
  'openchoreo.notificationchannel.delete':
    'observabilityalertsnotificationchannel:delete',
  'openchoreo.dataplane.update': 'dataplane:update',
  'openchoreo.dataplane.delete': 'dataplane:delete',
  'openchoreo.workflowplane.update': 'workflowplane:update',
  'openchoreo.workflowplane.delete': 'workflowplane:delete',
  'openchoreo.observabilityplane.update': 'observabilityplane:update',
  'openchoreo.observabilityplane.delete': 'observabilityplane:delete',
  'openchoreo.deploymentpipeline.create': 'deploymentpipeline:create',
  'openchoreo.deploymentpipeline.update': 'deploymentpipeline:update',
  'openchoreo.deploymentpipeline.delete': 'deploymentpipeline:delete',
  'openchoreo.clustercomponenttype.update': 'clustercomponenttype:update',
  'openchoreo.clustercomponenttype.delete': 'clustercomponenttype:delete',
  'openchoreo.clusterresourcetype.update': 'clusterresourcetype:update',
  'openchoreo.clusterresourcetype.delete': 'clusterresourcetype:delete',
  'openchoreo.clusterprojecttype.update': 'clusterprojecttype:update',
  'openchoreo.clusterprojecttype.delete': 'clusterprojecttype:delete',
  'openchoreo.clustertrait.update': 'clustertrait:update',
  'openchoreo.clustertrait.delete': 'clustertrait:delete',
  'openchoreo.clusterdataplane.update': 'clusterdataplane:update',
  'openchoreo.clusterdataplane.delete': 'clusterdataplane:delete',
  'openchoreo.clusterworkflowplane.update': 'clusterworkflowplane:update',
  'openchoreo.clusterworkflowplane.delete': 'clusterworkflowplane:delete',
  'openchoreo.clusterobservabilityplane.update':
    'clusterobservabilityplane:update',
  'openchoreo.clusterobservabilityplane.delete':
    'clusterobservabilityplane:delete',
  'openchoreo.clusterworkflow.update': 'clusterworkflow:update',
  'openchoreo.clusterworkflow.delete': 'clusterworkflow:delete',
};

/**
 * Mapping from Backstage catalog permissions to OpenChoreo API action names.
 * Used to translate native Backstage catalog.entity.* permissions to OpenChoreo
 * capability checks when the entity is an OpenChoreo-managed component.
 */
export const CATALOG_PERMISSION_TO_ACTION: Record<string, string> = {
  'catalog.entity.read': 'component:view',
  'catalog.entity.delete': 'component:delete',
  'catalog.entity.refresh': 'component:update',
};

/**
 * Entity kinds that should be checked against OpenChoreo permissions
 * when catalog.entity.* permissions are evaluated.
 *
 * - Component: Maps to OpenChoreo components
 * - System: Maps to OpenChoreo projects
 * - Domain: Maps to OpenChoreo namespaces
 * - Dataplane, WorkflowPlane, ObservabilityPlane, DeploymentPipeline: Namespace-scoped infrastructure
 * - ClusterDataplane, ClusterWorkflowPlane, ClusterObservabilityPlane: Cluster-scoped infrastructure
 * - ComponentType, TraitType, Workflow, ComponentWorkflow, Environment: Namespace-scoped platform resources
 * - ClusterComponentType, ClusterTraitType, ClusterWorkflow: Cluster-scoped platform resources
 */
export const OPENCHOREO_MANAGED_ENTITY_KINDS = [
  'Component',
  'Resource',
  'System',
  'Domain',
  'Dataplane',
  'WorkflowPlane',
  'ObservabilityPlane',
  'DeploymentPipeline',
  'ClusterDataplane',
  'ClusterWorkflowPlane',
  'ClusterObservabilityPlane',
  'ComponentType',
  'ResourceType',
  'ProjectType',
  'ClusterComponentType',
  'ClusterResourceType',
  'ClusterProjectType',
  'TraitType',
  'ClusterTraitType',
  'Workflow',
  'ClusterWorkflow',
  'ComponentWorkflow',
  'Environment',
  'ObservabilityAlertsNotificationChannel',
];

/**
 * Mapping from entity kind to the OpenChoreo action for each catalog permission.
 * Used to translate native Backstage catalog.entity.* permissions to OpenChoreo
 * capability checks based on the entity kind.
 *
 * Each kind maps to a different resource type in OpenChoreo:
 * - Component → component:* actions
 * - System → project:* actions
 * - Domain → namespace:* actions
 * - Dataplane/WorkflowPlane/ObservabilityPlane/DeploymentPipeline → respective :view actions
 * - ClusterDataplane/ClusterWorkflowPlane/ClusterObservabilityPlane → respective cluster:view actions
 * - ComponentType/TraitType/Workflow/ComponentWorkflow/Environment → respective :view actions
 * - ClusterComponentType/ClusterTraitType/ClusterWorkflow → respective cluster:view actions
 */
export const CATALOG_KIND_TO_ACTION: Record<string, Record<string, string>> = {
  component: {
    'catalog.entity.read': 'component:view',
    'catalog.entity.delete': 'component:delete',
    'catalog.entity.refresh': 'component:update',
  },
  resource: {
    'catalog.entity.read': 'resource:view',
    'catalog.entity.delete': 'resource:delete',
    'catalog.entity.refresh': 'resource:update',
  },
  system: {
    'catalog.entity.read': 'project:view',
  },
  domain: {
    'catalog.entity.read': 'namespace:view',
  },
  dataplane: {
    'catalog.entity.read': 'dataplane:view',
  },
  workflowplane: {
    'catalog.entity.read': 'workflowplane:view',
  },
  observabilityplane: {
    'catalog.entity.read': 'observabilityplane:view',
  },
  deploymentpipeline: {
    'catalog.entity.read': 'deploymentpipeline:view',
  },
  clusterdataplane: {
    'catalog.entity.read': 'clusterdataplane:view',
  },
  clusterworkflowplane: {
    'catalog.entity.read': 'clusterworkflowplane:view',
  },
  clusterobservabilityplane: {
    'catalog.entity.read': 'clusterobservabilityplane:view',
  },
  componenttype: {
    'catalog.entity.read': 'componenttype:view',
  },
  resourcetype: {
    'catalog.entity.read': 'resourcetype:view',
  },
  projecttype: {
    'catalog.entity.read': 'projecttype:view',
  },
  clustercomponenttype: {
    'catalog.entity.read': 'clustercomponenttype:view',
  },
  clusterresourcetype: {
    'catalog.entity.read': 'clusterresourcetype:view',
  },
  clusterprojecttype: {
    'catalog.entity.read': 'clusterprojecttype:view',
  },
  traittype: {
    'catalog.entity.read': 'trait:view',
  },
  clustertraittype: {
    'catalog.entity.read': 'clustertrait:view',
  },
  workflow: {
    'catalog.entity.read': 'workflow:view',
  },
  clusterworkflow: {
    'catalog.entity.read': 'clusterworkflow:view',
  },
  componentworkflow: {
    'catalog.entity.read': 'workflow:view',
  },
  environment: {
    'catalog.entity.read': 'environment:view',
  },
  observabilityalertsnotificationchannel: {
    'catalog.entity.read': 'observabilityalertsnotificationchannel:view',
  },
};
