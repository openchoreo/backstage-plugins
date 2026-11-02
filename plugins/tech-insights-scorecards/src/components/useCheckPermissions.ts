import { usePermission } from '@backstage/plugin-permission-react';
import {
  dynamicCheckManagePermission,
  dynamicCheckReadPermission,
} from '@openchoreo/backstage-plugin-tech-insights-dynamic-checks-common';

export interface CheckPermissions {
  loading: boolean;
  /** Read-only check management and the catalog-wide score overview. */
  canRead: boolean;
  /** Create, edit, delete, publish and dry-run checks; collect facts now. */
  canManage: boolean;
}

/**
 * What the signed-in user may do with dynamic checks. The backend enforces
 * the same permissions; this only decides what the UI offers.
 */
export function useCheckPermissions(): CheckPermissions {
  const read = usePermission({ permission: dynamicCheckReadPermission });
  const manage = usePermission({ permission: dynamicCheckManagePermission });

  return {
    loading: read.loading || manage.loading,
    canRead: read.allowed,
    canManage: manage.allowed,
  };
}

export const NOT_ALLOWED_TOOLTIP = "You don't have permission to do this.";
