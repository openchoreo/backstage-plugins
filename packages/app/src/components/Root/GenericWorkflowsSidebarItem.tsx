import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import { SidebarItem } from '@backstage/core-components';

/**
 * Sidebar item for Generic Workflows.
 * Provides access to org-level workflow templates and runs.
 */
export const GenericWorkflowsSidebarItem = () => {
  return (
    <SidebarItem
      icon={PlayArrowIcon}
      to="admin/workflows"
      text="Workflows"
    />
  );
};
