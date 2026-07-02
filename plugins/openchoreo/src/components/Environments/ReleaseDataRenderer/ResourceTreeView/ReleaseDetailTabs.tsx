import { useState, useEffect, useCallback, type FC } from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  IconButton,
  Tooltip,
  Chip,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import YAML from 'yaml';
import { YamlViewer } from '@openchoreo/backstage-design-system';
import { useTreeStyles } from './treeStyles';
import { ResourceEventsTable } from './ResourceEventsTable';
import type { LayoutNode } from './treeTypes';

const TABS = [
  { id: 'events', label: 'Events' },
  { id: 'spec', label: 'Spec' },
] as const;

interface ReleaseDetailTabsProps {
  node: LayoutNode;
  namespaceName: string;
  releaseBindingName: string;
}

/**
 * Detail tabs shown when a rendered release node is selected in the resource
 * tree. Surfaces the release's own Kubernetes events and full spec (YAML),
 * reusing the same components used for individual resources.
 */
export const ReleaseDetailTabs: FC<ReleaseDetailTabsProps> = ({
  node,
  namespaceName,
  releaseBindingName,
}) => {
  const classes = useTreeStyles();
  const [activeTab, setActiveTab] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  // Reset tab when switching to a different node
  useEffect(() => {
    setActiveTab(0);
  }, [node.id]);

  const currentTab = TABS[activeTab]?.id;

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
          {TABS.map(tab => (
            <Tab key={tab.id} label={tab.label} />
          ))}
        </Tabs>
        {node.targetPlane && (
          <Chip
            label={`Target: ${node.targetPlane}`}
            size="small"
            variant="outlined"
            style={{ marginRight: 8 }}
          />
        )}
        {currentTab === 'events' && (
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

        {currentTab === 'spec' && (
          <>
            {node.specObject ? (
              <YamlViewer
                value={YAML.stringify(node.specObject)}
                maxHeight="auto"
              />
            ) : (
              <Box className={classes.drawerEmptyState}>
                <Typography variant="body2" color="textSecondary">
                  No release spec available
                </Typography>
              </Box>
            )}
          </>
        )}
      </Box>
    </>
  );
};
