import { useMemo, useState } from 'react';
import type { FC } from 'react';
import { Typography } from '@material-ui/core';
import InfoIcon from '@material-ui/icons/Info';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import { ReleaseData } from './types';
import { useReleaseInfoStyles } from './styles';
import { getHealthStatusForTab } from './utils';
import { useResourceGroups } from './useResourceGroups';
import { OverviewTab } from './OverviewTab';
import { ResourceGroupTab } from './ResourceGroupTab';

interface ReleaseInfoTabbedViewProps {
  releaseData: ReleaseData;
}

/**
 * Tabbed view for displaying release information.
 * Shows overview tab and resource-specific tabs grouped by kind.
 */
export const ReleaseInfoTabbedView: FC<ReleaseInfoTabbedViewProps> = ({
  releaseData,
}) => {
  const classes = useReleaseInfoStyles();
  const data = releaseData?.data;
  const [activeTab, setActiveTab] = useState<string>('overview');

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

  // Set default tab if not set
  useMemo(() => {
    if (!activeTab && tabs.length > 0) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs, activeTab]);

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
