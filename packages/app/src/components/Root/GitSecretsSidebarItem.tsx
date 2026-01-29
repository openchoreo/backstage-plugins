import VpnKeyIcon from '@material-ui/icons/VpnKey';
import { SidebarItem } from '@backstage/core-components';

/**
 * Sidebar item for Git Secrets management.
 * TODO: Add permission checks in Phase 2 when permissions are implemented.
 */
export const GitSecretsSidebarItem = () => {
  return (
    <SidebarItem
      icon={VpnKeyIcon}
      to="admin/git-secrets"
      text="Git Secrets"
    />
  );
};
