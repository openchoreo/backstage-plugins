import { useMemo, useState } from 'react';
import { Typography, Grid, Box, IconButton, Button } from '@material-ui/core';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import ChatOutlinedIcon from '@material-ui/icons/ChatOutlined';
import { InfoCard } from '@backstage/core-components';
import BugReportOutlinedIcon from '@material-ui/icons/BugReportOutlined';
import TimelineOutlinedIcon from '@material-ui/icons/TimelineOutlined';
import ExploreOutlinedIcon from '@material-ui/icons/ExploreOutlined';
import NotInterestedOutlinedIcon from '@material-ui/icons/NotInterestedOutlined';
import AssignmentTurnedInOutlinedIcon from '@material-ui/icons/AssignmentTurnedInOutlined';
import EmojiObjectsOutlinedIcon from '@material-ui/icons/EmojiObjectsOutlined';
import { SystemTimelineSection } from './sections/SystemTimelineSection';
import { RootCausesSection } from './sections/RootCausesSection';
import { InvestigationPathSection } from './sections/InvestigationPathSection';
import { ExcludedCausesSection } from './sections/ExcludedCausesSection';
import { RecommendationsSection } from './sections/RecommendationsSection';
import { VisibilityImprovementsSection } from './sections/VisibilityImprovementsSection';
import { IncidentOverviewSection } from './sections/IncidentOverviewSection';
import { AssessmentSection } from './sections/AssessmentSection';
import { ChatPanelSection } from './sections/ChatPanelSection';
import { useRCAReportStyles } from './styles';
import { EntityLinkContext } from './EntityLinkContext';
import {
  useEntitiesByUids,
  extractEntityUids,
} from '../../../hooks/useEntitiesByUids';
import type { AIRCAAgentComponents } from '@openchoreo/backstage-plugin-common';
import type { RCAAgentApi } from '../../../api/RCAAgentApi';

type RCAReportDetailed = AIRCAAgentComponents['schemas']['RCAReportDetailed'];

interface ChatContext {
  namespaceName: string;
  environmentName: string;
  projectName: string;
  rcaAgentApi: RCAAgentApi;
}

interface RCAReportViewProps {
  report: RCAReportDetailed;
  reportId: string;
  onBack: () => void;
  chatContext: ChatContext;
}

export const RCAReportView = ({
  report,
  reportId,
  onBack,
  chatContext,
}: RCAReportViewProps) => {
  const classes = useRCAReportStyles();
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Extract all entity UIDs from the report
  const uids = useMemo(() => {
    return extractEntityUids(JSON.stringify(report));
  }, [report]);

  const { entityMap, loading: entitiesLoading } = useEntitiesByUids(uids);

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const rcaReport = report.report;

  if (!rcaReport) {
    return (
      <Box>
        <Box className={classes.header}>
          <Box className={classes.headerLeft}>
            <IconButton
              onClick={onBack}
              size="small"
              className={classes.backButton}
              title="Back to RCA reports"
            >
              <ArrowBackIcon />
            </IconButton>
            <Box className={classes.titleContainer}>
              <Typography variant="h5" className={classes.title}>
                RCA Report
              </Typography>
              {report.timestamp && (
                <Typography variant="body2" className={classes.subtitle}>
                  {report.reportId}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
        <Box className={classes.content}>
          <Box className={classes.emptyState}>
            <Typography variant="h6" gutterBottom>
              Report content not available
            </Typography>
            <Typography variant="body2" color="textSecondary">
              The RCA report analysis is not yet complete or not available.
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  const isNoRootCauseIdentified =
    rcaReport.result?.type === 'no_root_cause_identified';

  const timeline =
    rcaReport.result?.type === 'root_cause_identified'
      ? rcaReport.result.timeline
      : undefined;

  const rootCauses =
    rcaReport.result?.type === 'root_cause_identified'
      ? rcaReport.result.root_causes
      : undefined;

  const excludedCauses =
    rcaReport.result?.type === 'root_cause_identified'
      ? rcaReport.result.excluded_causes
      : undefined;

  const recommendations = (() => {
    if (rcaReport.result?.type === 'root_cause_identified') {
      return rcaReport.result.recommendations;
    }
    if (rcaReport.result?.type === 'no_root_cause_identified') {
      return rcaReport.result.recommendations;
    }
    return undefined;
  })();

  const noRootCauseResult =
    rcaReport.result?.type === 'no_root_cause_identified'
      ? rcaReport.result
      : undefined;

  const alertContext = rcaReport.alert_context;

  const investigationPath = rcaReport.investigation_path;

  return (
    <EntityLinkContext.Provider value={{ entityMap, loading: entitiesLoading }}>
      <Box>
        <Box className={classes.header}>
          <Box className={classes.headerLeft}>
            <IconButton
              onClick={onBack}
              size="small"
              className={classes.backButton}
              title="Back to RCA reports"
            >
              <ArrowBackIcon />
            </IconButton>
            <Box className={classes.titleContainer}>
              <Typography variant="h5" className={classes.title}>
                RCA Report
              </Typography>
              {report.timestamp && (
                <Typography variant="body2" className={classes.subtitle}>
                  {report.reportId}
                </Typography>
              )}
            </Box>
          </Box>
          <Button
            variant={isChatOpen ? 'contained' : 'outlined'}
            color="primary"
            size="small"
            startIcon={<ChatOutlinedIcon />}
            onClick={() => setIsChatOpen(!isChatOpen)}
          >
            Chat
          </Button>
        </Box>
        <Box className={classes.content}>
          <Grid container spacing={1}>
            <Grid item xs={12} style={{ flex: '0 0 62%', maxWidth: '62%' }}>
              <IncidentOverviewSection
                summary={rcaReport.summary || ''}
                alertContext={alertContext}
                reportId={reportId}
                reportTimestamp={report.timestamp}
                formatTimestamp={formatTimestamp}
              />
              {isNoRootCauseIdentified && noRootCauseResult && (
                <AssessmentSection noRootCauseResult={noRootCauseResult} />
              )}
              {rootCauses && (
                <Box className={classes.infoCardSpacing}>
                  <InfoCard
                    title={
                      <span className={classes.cardTitle}>
                        <BugReportOutlinedIcon
                          className={classes.cardTitleIcon}
                        />
                        Likely Root Causes
                      </span>
                    }
                  >
                    <RootCausesSection rootCauses={rootCauses} />
                  </InfoCard>
                </Box>
              )}
              {excludedCauses && excludedCauses.length > 0 && (
                <Box className={classes.infoCardSpacing}>
                  <InfoCard
                    title={
                      <span className={classes.cardTitle}>
                        <NotInterestedOutlinedIcon
                          className={classes.cardTitleIcon}
                        />
                        Unlikely Causes
                      </span>
                    }
                  >
                    <ExcludedCausesSection excludedCauses={excludedCauses} />
                  </InfoCard>
                </Box>
              )}
              {recommendations?.recommended_actions &&
                recommendations.recommended_actions.length > 0 && (
                  <Box className={classes.infoCardSpacing}>
                    <InfoCard
                      title={
                        <span className={classes.cardTitle}>
                          <AssignmentTurnedInOutlinedIcon
                            className={classes.cardTitleIcon}
                          />
                          Actionable Next Steps
                        </span>
                      }
                    >
                      <RecommendationsSection
                        actions={recommendations.recommended_actions}
                      />
                    </InfoCard>
                  </Box>
                )}
              {recommendations?.observability_recommendations &&
                recommendations.observability_recommendations.length > 0 && (
                  <InfoCard
                    title={
                      <span className={classes.cardTitle}>
                        <EmojiObjectsOutlinedIcon
                          className={classes.cardTitleIcon}
                        />
                        Observability Suggestions
                      </span>
                    }
                  >
                    <VisibilityImprovementsSection
                      recommendations={
                        recommendations.observability_recommendations
                      }
                    />
                  </InfoCard>
                )}
            </Grid>

            <Grid
              item
              xs={12}
              style={{ flex: '0 0 38%', maxWidth: '38%' }}
              className={classes.sidebarColumn}
            >
              {isChatOpen && (
                <ChatPanelSection
                  reportId={report.reportId || ''}
                  chatContext={chatContext}
                />
              )}
              {timeline && timeline.length > 0 && (
                <Box className={classes.infoCardSpacing}>
                  <InfoCard
                    title={
                      <span className={classes.cardTitle}>
                        <TimelineOutlinedIcon
                          className={classes.cardTitleIcon}
                        />
                        System Timeline
                      </span>
                    }
                  >
                    <SystemTimelineSection timeline={timeline} />
                  </InfoCard>
                </Box>
              )}
              {investigationPath && investigationPath.length > 0 && (
                <InfoCard
                  title={
                    <span className={classes.cardTitle}>
                      <ExploreOutlinedIcon className={classes.cardTitleIcon} />
                      Investigation Path
                    </span>
                  }
                >
                  <InvestigationPathSection
                    investigationPath={investigationPath}
                  />
                </InfoCard>
              )}
            </Grid>
          </Grid>
        </Box>
      </Box>
    </EntityLinkContext.Provider>
  );
};
