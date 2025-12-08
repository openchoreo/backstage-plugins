import { useMemo, useEffect } from 'react';
import type { FC } from 'react';
import { Typography } from '@material-ui/core';
import InfoIcon from '@material-ui/icons/Info';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import { useUrlSyncedTab } from '@openchoreo/backstage-plugin-react';
import { ReleaseData } from './types';
import { useReleaseInfoStyles } from './styles';
import { getHealthStatusForTab } from './utils';
import { useResourceGroups } from './useResourceGroups';
import { OverviewTab } from './OverviewTab';
import { ResourceGroupTab } from './ResourceGroupTab';

interface ReleaseInfoTabbedViewProps {
  releaseData: ReleaseData;
  /** Initial tab to display (from URL) */
  initialTab?: string;
  /** Callback when tab changes (to update URL) */
  onTabChange?: (tabId: string) => void;
}

/**
 * Tabbed view for displaying release information.
 * Shows overview tab and resource-specific tabs grouped by kind.
 */
export const ReleaseInfoTabbedView: FC<ReleaseInfoTabbedViewProps> = ({
  releaseData,
  initialTab,
  onTabChange,
}) => {
  const classes = useReleaseInfoStyles();
  const data = releaseData?.data;

  const [activeTab, setActiveTab] = useUrlSyncedTab({
    initialTab,
    defaultTab: 'overview',
    onTabChange,
  });

  // Group resources by kind
  const resourceGroups = useResourceGroups(data);

  // Build tabs
  const tabs = useMemo<TabItemData[]>(() => {
    const tabList: TabItemData[] = [
      {
        id: 'overview',
        label: 'Overview',
        icon: <InfoIcon />,
      },
    ];

    resourceGroups.forEach(group => {
      const resourceCount = group.resources.length || group.definitions.length;
      tabList.push({
        id: `resource-${group.kind}`,
        label: group.kind,
        count: resourceCount,
        status: getHealthStatusForTab(group.overallHealth),
      });
    });

    return tabList;
  }, [resourceGroups]);

  // Set default tab if not set and no initial tab provided
  useEffect(() => {
    if (!activeTab && tabs.length > 0) {
      const defaultTab = tabs[0].id;
      // Use replace: true to avoid adding to history when auto-setting default tab
      setActiveTab(defaultTab, true);
    }
  }, [tabs, activeTab, setActiveTab]);

  if (!data || (!data.spec && !data.status)) {
    return (
      <Typography className={classes.emptyValue}>
        No release data available
      </Typography>
    );
  }

  // Render active tab content
  const renderTabContent = () => {
    if (activeTab === 'overview') {
      return <OverviewTab data={data} classes={classes} />;
    }

    if (activeTab.startsWith('resource-')) {
      const kind = activeTab.replace('resource-', '');
      const group = resourceGroups.find(g => g.kind === kind);
      if (group) {
        return <ResourceGroupTab group={group} classes={classes} />;
      }
    }

    return null;
  };

  return (
    <VerticalTabNav
      tabs={tabs}
      activeTabId={activeTab}
      onChange={setActiveTab}
      className={classes.tabNav}
    >
      {renderTabContent()}
    </VerticalTabNav>
  );
};
