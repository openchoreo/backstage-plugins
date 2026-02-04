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
import { ClusterRoleBindingsContent } from './ClusterRoleBindingsContent';
import { NamespaceRoleBindingsContent } from './NamespaceRoleBindingsContent';

const useStyles = makeStyles(() => ({
  verticalTabWrapper: {
    height: '100%',
    minHeight: 500,
  },
}));

const SUB_TABS: TabItemData[] = [
  { id: SCOPE_CLUSTER, label: 'Cluster Role Bindings', icon: <PublicIcon /> },
  { id: SCOPE_NAMESPACE, label: 'Namespace Role Bindings', icon: <FolderIcon /> },
];

interface MappingsTabProps {
  initialTab?: string;
  onTabChange?: (tabId: string, replace?: boolean) => void;
}

export const MappingsTab = ({ initialTab, onTabChange }: MappingsTabProps) => {
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
        {activeTab === SCOPE_CLUSTER && <ClusterRoleBindingsContent />}
        {activeTab === SCOPE_NAMESPACE && <NamespaceRoleBindingsContent />}
      </VerticalTabNav>
    </Box>
  );
};
