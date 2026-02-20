import { useState, useEffect, type FC } from 'react';
import { Box, Tabs, Tab, Typography } from '@material-ui/core';
import YAML from 'yaml';
import { YamlViewer } from '@openchoreo/backstage-design-system';
import { useTreeStyles } from './treeStyles';
import type { LayoutNode } from './treeTypes';

const LOGGABLE_KINDS = new Set(['Deployment', 'Pod', 'Job', 'CronJob']);

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
}

export const ResourceDetailTabs: FC<ResourceDetailTabsProps> = ({ node }) => {
  const classes = useTreeStyles();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = getTabsForKind(node.kind);

  // Reset tab when switching to a different node
  useEffect(() => {
    setActiveTab(0);
  }, [node.id]);

  const currentTab = tabs[activeTab]?.id;

  return (
    <>
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        indicatorColor="primary"
        textColor="primary"
        className={classes.drawerTabs}
      >
        {tabs.map(tab => (
          <Tab key={tab.id} label={tab.label} />
        ))}
      </Tabs>

      <Box className={classes.drawerTabContent}>
        {currentTab === 'events' && (
          <Box className={classes.drawerEmptyState}>
            <Typography variant="body2" color="textSecondary">
              No events available
            </Typography>
          </Box>
        )}

        {currentTab === 'logs' && (
          <Box className={classes.drawerEmptyState}>
            <Typography variant="body2" color="textSecondary">
              No logs available
            </Typography>
          </Box>
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
