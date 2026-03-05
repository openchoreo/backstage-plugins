import { useState, useEffect, useCallback, type FC } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import YAML from 'yaml';
import { YamlViewer } from '@openchoreo/backstage-design-system';
import { useTreeStyles } from './treeStyles';
import { ResourceEventsTable } from './ResourceEventsTable';
import { ResourcePodLogsViewer } from './ResourcePodLogsViewer';
import type { LayoutNode } from './treeTypes';

const LOGGABLE_KINDS = new Set(['Pod']);

const REFRESHABLE_TABS = new Set(['events', 'logs']);

interface TabConfig {
  id: string;
  label: string;
}

function getTabsForKind(kind: string): TabConfig[] {
  const tabs: TabConfig[] = [{ id: 'events', label: 'Events' }];
  if (LOGGABLE_KINDS.has(kind)) {
    tabs.push({ id: 'logs', label: 'Logs' });
  }
  tabs.push({ id: 'definition', label: 'Definition' });
  return tabs;
}

interface ResourceDetailTabsProps {
  node: LayoutNode;
  namespaceName: string;
  releaseBindingName: string;
}

export const ResourceDetailTabs: FC<ResourceDetailTabsProps> = ({
  node,
  namespaceName,
  releaseBindingName,
}) => {
  const classes = useTreeStyles();
  const [activeTab, setActiveTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const tabs = getTabsForKind(node.kind);

  // Reset tab when switching to a different node
  useEffect(() => {
    setActiveTab(0);
  }, [node.id]);

  const currentTab = tabs[activeTab]?.id;

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <>
      <Box display="flex" alignItems="center">
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          indicatorColor="primary"
          textColor="primary"
          className={classes.drawerTabs}
          style={{ flex: 1 }}
        >
          {tabs.map(tab => (
            <Tab key={tab.id} label={tab.label} />
          ))}
        </Tabs>
        {currentTab && REFRESHABLE_TABS.has(currentTab) && (
          <Tooltip title="Refresh">
            <IconButton size="small" onClick={handleRefresh}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box className={classes.drawerTabContent}>
        {currentTab === 'events' && (
          <ResourceEventsTable
            node={node}
            namespaceName={namespaceName}
            releaseBindingName={releaseBindingName}
            refreshKey={refreshKey}
          />
        )}

        {currentTab === 'logs' && (
          <ResourcePodLogsViewer
            node={node}
            namespaceName={namespaceName}
            releaseBindingName={releaseBindingName}
            refreshKey={refreshKey}
          />
        )}

        {currentTab === 'definition' && (
          <>
            {node.specObject ? (
              <YamlViewer
                value={YAML.stringify(node.specObject)}
                maxHeight="auto"
              />
            ) : (
              <Box className={classes.drawerEmptyState}>
                <Typography variant="body2" color="textSecondary">
                  No resource definition available
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </>
  );
};
