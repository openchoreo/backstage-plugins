import { useMemo } from 'react';
import { Typography } from '@material-ui/core';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import {
  formatRelativeTime,
  useUrlSyncedTab,
} from '@openchoreo/backstage-plugin-react';
import { DetailPageLayout } from '../Environments/components/DetailPageLayout';
import { BuildStatusChip } from './BuildStatusChip';
import { LogsContent, RunMetadataContent } from './components';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';

type RunDetailsTab = 'logs' | 'details';

interface WorkflowRunDetailsPageProps {
  run: ModelsBuild;
  onBack: () => void;
  /** Initial tab to display (from URL) */
  initialTab?: RunDetailsTab;
  /** Callback when tab changes (to update URL) */
  onTabChange?: (tab: RunDetailsTab) => void;
}

export const WorkflowRunDetailsPage = ({
  run,
  onBack,
  initialTab,
  onTabChange,
}: WorkflowRunDetailsPageProps) => {
  const [activeTab, setActiveTab] = useUrlSyncedTab<RunDetailsTab>({
    initialTab,
    defaultTab: 'logs',
    onTabChange,
  });

  const tabs = useMemo<TabItemData[]>(
    () => [
      {
        id: 'logs',
        label: 'Logs',
        icon: <DescriptionOutlinedIcon fontSize="small" />,
      },
      {
        id: 'details',
        label: 'Details',
        icon: <InfoOutlinedIcon fontSize="small" />,
      },
    ],
    [],
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'logs':
        return <LogsContent build={run} />;
      case 'details':
        return <RunMetadataContent build={run} />;
      default:
        return null;
    }
  };

  const subtitle = (
    <>
      <BuildStatusChip status={run.status} />
      <Typography variant="body2" color="textSecondary">
        {formatRelativeTime(run.createdAt || '')}
      </Typography>
    </>
  );

  return (
    <DetailPageLayout
      title={run.name || 'Workflow Run'}
      subtitle={subtitle}
      onBack={onBack}
    >
      <VerticalTabNav
        tabs={tabs}
        activeTabId={activeTab}
        onChange={tabId => setActiveTab(tabId as RunDetailsTab)}
      >
        {renderTabContent()}
      </VerticalTabNav>
    </DetailPageLayout>
  );
};
