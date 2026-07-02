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
import { ResourcePodTerminalViewer } from './ResourcePodTerminalViewer';
import { getPodContainerNames } from './podUtils';
import type { ExecContext, LayoutNode } from './treeTypes';

const LOGGABLE_KINDS = new Set(['Pod']);
const EXECUTABLE_KINDS = new Set(['Pod']);

const REFRESHABLE_TABS = new Set(['events', 'logs']);

interface TabConfig {
  id: string;
  label: string;
}

function getTabsForKind(kind: string, canExec: boolean): TabConfig[] {
  const tabs: TabConfig[] = [{ id: 'events', label: 'Events' }];
  if (LOGGABLE_KINDS.has(kind)) {
    tabs.push({ id: 'logs', label: 'Logs' });
  }
  if (canExec && EXECUTABLE_KINDS.has(kind)) {
    tabs.push({ id: 'terminal', label: 'Terminal' });
  }
  tabs.push({ id: 'definition', label: 'Definition' });
  return tabs;
}

interface ResourceDetailTabsProps {
  node: LayoutNode;
  namespaceName: string;
  releaseBindingName: string;
  /** Present when exec is available (component/env context resolved). */
  execContext?: ExecContext;
}

export const ResourceDetailTabs: FC<ResourceDetailTabsProps> = ({
  node,
  namespaceName,
  releaseBindingName,
  execContext,
}) => {
  const classes = useTreeStyles();
  const [activeTab, setActiveTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // A Terminal tab is offered only for Pod nodes when we have the component /
  // environment context needed to open an exec session.
  const canExec = Boolean(execContext);
  const tabs = getTabsForKind(node.kind, canExec);

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

        {currentTab === 'terminal' && execContext && (
          <ResourcePodTerminalViewer
            execContext={execContext}
            podName={node.name}
            containers={getPodContainerNames(node.specObject)}
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
