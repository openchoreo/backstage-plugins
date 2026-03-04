import { Box } from '@material-ui/core';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import { InfoCard } from '@backstage/core-components';
import { useRCAReportStyles } from '../styles';
import { PatchTabContent } from './PatchTabContent';
import type {
  RCAAgentApi,
  RecommendedAction,
} from '../../../../api/RCAAgentApi';

interface ChatContext {
  namespaceName: string;
  environmentName: string;
  projectName: string;
  rcaAgentApi: RCAAgentApi;
  backendBaseUrl?: string;
}

interface QuickFixesPanelSectionProps {
  reportId: string;
  chatContext: ChatContext;
  revisedActions: { index: number; action: RecommendedAction }[];
}

export const QuickFixesPanelSection = ({
  reportId,
  chatContext,
  revisedActions,
}: QuickFixesPanelSectionProps) => {
  const classes = useRCAReportStyles();

  return (
    <Box className={classes.fixesPanelWrapper}>
      <InfoCard
        title={
          <span className={classes.cardTitle}>
            <AutorenewIcon className={classes.cardTitleIcon} />
            Quick Fixes
          </span>
        }
        className={classes.fixesPanel}
      >
        <Box className={classes.fixesContent}>
          <PatchTabContent
            reportId={reportId}
            chatContext={chatContext}
            revisedActions={revisedActions}
          />
        </Box>
      </InfoCard>
    </Box>
  );
};
