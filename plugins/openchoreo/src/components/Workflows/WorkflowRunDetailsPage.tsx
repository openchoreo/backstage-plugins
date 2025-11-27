import { useState, useMemo } from 'react';
import { Typography } from '@material-ui/core';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import {
  VerticalTabNav,
  TabItemData,
} from '@openchoreo/backstage-design-system';
import { DetailPageLayout } from '../Environments/components/DetailPageLayout';
import { BuildStatusChip } from './BuildStatusChip';
import { LogsContent, RunMetadataContent } from './components';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';

interface WorkflowRunDetailsPageProps {
  run: ModelsBuild;
  onBack: () => void;
}

export const WorkflowRunDetailsPage = ({
  run,
  onBack,
}: WorkflowRunDetailsPageProps) => {
  const [activeTab, setActiveTab] = useState('logs');

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
        onChange={setActiveTab}
      >
        {renderTabContent()}
      </VerticalTabNav>
    </DetailPageLayout>
  );
};
