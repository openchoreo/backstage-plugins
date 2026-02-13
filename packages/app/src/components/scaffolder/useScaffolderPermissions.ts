import { usePermission } from '@backstage/plugin-permission-react';
import {
  openchoreoProjectCreatePermission,
  openchoreoComponentCreatePermission,
  openchoreoEnvironmentCreatePermission,
  openchoreoTraitCreatePermission,
  openchoreoComponentTypeCreatePermission,
  openchoreoComponentWorkflowCreatePermission,
  openchoreoNamespaceCreatePermission,
} from '@openchoreo/backstage-plugin-common';

export type TemplatePermissionState = {
  allowed: boolean;
  loading: boolean;
};

export type ScaffolderPermissions = Record<string, TemplatePermissionState>;

/**
 * Hook that checks create permissions for each scaffolder template type.
 * Returns a map from template spec.type to permission state.
 */
export const useScaffolderPermissions = (): ScaffolderPermissions => {
  const project = usePermission({
    permission: openchoreoProjectCreatePermission,
  });
  const component = usePermission({
    permission: openchoreoComponentCreatePermission,
  });
  const environment = usePermission({
    permission: openchoreoEnvironmentCreatePermission,
  });
  const trait = usePermission({
    permission: openchoreoTraitCreatePermission,
  });
  const componentType = usePermission({
    permission: openchoreoComponentTypeCreatePermission,
  });
  const componentWorkflow = usePermission({
    permission: openchoreoComponentWorkflowCreatePermission,
  });
  const namespace = usePermission({
    permission: openchoreoNamespaceCreatePermission,
  });

  return {
    'System (Project)': {
      allowed: project.allowed,
      loading: project.loading,
    },
    Component: {
      allowed: component.allowed,
      loading: component.loading,
    },
    Environment: {
      allowed: environment.allowed,
      loading: environment.loading,
    },
    Trait: { allowed: trait.allowed, loading: trait.loading },
    ComponentType: {
      allowed: componentType.allowed,
      loading: componentType.loading,
    },
    ComponentWorkflow: {
      allowed: componentWorkflow.allowed,
      loading: componentWorkflow.loading,
    },
    Namespace: {
      allowed: namespace.allowed,
      loading: namespace.loading,
    },
  };
};
