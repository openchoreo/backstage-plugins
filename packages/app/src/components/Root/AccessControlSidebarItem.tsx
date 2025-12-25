import SecurityIcon from '@material-ui/icons/Security';
import { SidebarItem } from '@backstage/core-components';
import {
  useAuthzEnabled,
  useRolePermissions,
  useRoleMappingPermissions,
} from '@openchoreo/backstage-plugin-react';

/**
 * Sidebar item for Access Control that checks both feature flag and permissions.
 * Only renders if authz is enabled AND user has at least one of role:view or rolemapping:view permissions.
 */
export const AccessControlSidebarItem = () => {
  const authzEnabled = useAuthzEnabled();
  const { canView: canViewRoles, loading: rolesLoading } = useRolePermissions();
  const { canView: canViewMappings, loading: mappingsLoading } =
    useRoleMappingPermissions();

  // Don't render while permissions are loading to avoid flicker
  if (rolesLoading || mappingsLoading) {
    return null;
  }

  // Hide if authz is disabled or user has neither permission
  if (!authzEnabled || (!canViewRoles && !canViewMappings)) {
    return null;
  }

  return (
    <SidebarItem
      icon={SecurityIcon}
      to="admin/access-control"
      text="Access Control"
    />
  );
};
