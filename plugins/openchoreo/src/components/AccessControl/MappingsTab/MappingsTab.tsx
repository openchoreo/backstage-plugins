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

const useStyles = makeStyles(theme => ({
  verticalTabWrapper: {
    height: '100%',
    minHeight: 500,
  },
  contentRoot: {
    marginTop: -theme.spacing(2),
  },
}));

const SUB_TABS: TabItemData[] = [
  { id: SCOPE_CLUSTER, label: 'Cluster', icon: <PublicIcon /> },
  {
    id: SCOPE_NAMESPACE,
    label: 'Namespace',
    icon: <FolderIcon />,
  },
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
        <Box className={classes.contentRoot}>
          {activeTab === SCOPE_CLUSTER && <ClusterRoleBindingsContent />}
          {activeTab === SCOPE_NAMESPACE && <NamespaceRoleBindingsContent />}
        </Box>
      </VerticalTabNav>
    </Box>
  );
};
