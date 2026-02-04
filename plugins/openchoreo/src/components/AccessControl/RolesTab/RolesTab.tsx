import { Box } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import PublicIcon from '@material-ui/icons/Public';
import FolderIcon from '@material-ui/icons/Folder';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import { useUrlSyncedTab } from '@openchoreo/backstage-plugin-react';
import { SCOPE_CLUSTER, SCOPE_NAMESPACE } from '../constants';
import { ClusterRolesContent } from './ClusterRolesContent';
import { NamespaceRolesContent } from './NamespaceRolesContent';

const useStyles = makeStyles(() => ({
  verticalTabWrapper: {
    height: '100%',
    minHeight: 500,
  },
}));

const SUB_TABS: TabItemData[] = [
  { id: SCOPE_CLUSTER, label: 'Cluster Roles', icon: <PublicIcon /> },
  { id: SCOPE_NAMESPACE, label: 'Namespace Roles', icon: <FolderIcon /> },
];

interface RolesTabProps {
  initialTab?: string;
  onTabChange?: (tabId: string, replace?: boolean) => void;
}

export const RolesTab = ({ initialTab, onTabChange }: RolesTabProps) => {
  const classes = useStyles();
  const [activeTab, setActiveTab] = useUrlSyncedTab({
    initialTab,
    defaultTab: SCOPE_CLUSTER,
    onTabChange,
  });

  return (
    <Box className={classes.verticalTabWrapper}>
      <VerticalTabNav
        tabs={SUB_TABS}
        activeTabId={activeTab}
        onChange={setActiveTab}
      >
        {activeTab === SCOPE_CLUSTER && <ClusterRolesContent />}
        {activeTab === SCOPE_NAMESPACE && <NamespaceRolesContent />}
      </VerticalTabNav>
    </Box>
  );
};
