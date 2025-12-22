import { Typography, Grid, Box, Tooltip, IconButton } from '@material-ui/core';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { InfoCard } from '@backstage/core-components';
import DescriptionOutlinedIcon from '@material-ui/icons/DescriptionOutlined';
import { StatusBadge } from '@openchoreo/backstage-design-system';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
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
import { useRCAReportStyles } from './styles';
import type { ObservabilityComponents } from '@openchoreo/backstage-plugin-common';

type RCAReportDetailed =
  ObservabilityComponents['schemas']['RCAReportDetailed'];

interface RCAReportViewProps {
  report: RCAReportDetailed;
  alertId: string;
  onBack: () => void;
}

export const RCAReportView = ({
  report,
  alertId,
  onBack,
}: RCAReportViewProps) => {
  const classes = useRCAReportStyles();

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
      <>
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
                RCA Report'
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
      </>
    );
  }

  const isRcaNotPerformed = rcaReport.result?.type === 'rca_not_performed';

  const timeline =
    rcaReport.result?.type === 'issue_identified'
      ? rcaReport.result.timeline
      : undefined;

  const rootCauses =
    rcaReport.result?.type === 'issue_identified'
      ? rcaReport.result.root_causes
      : undefined;

  const excludedCauses =
    rcaReport.result?.type === 'issue_identified'
      ? rcaReport.result.excluded_causes
      : undefined;

  const recommendations = (() => {
    if (rcaReport.result?.type === 'issue_identified') {
      return rcaReport.result.recommendations;
    }
    if (rcaReport.result?.type === 'rca_not_performed') {
      return rcaReport.result.recommendations;
    }
    return undefined;
  })();

  const notPerformedReason =
    rcaReport.result?.type === 'rca_not_performed'
      ? rcaReport.result.reason
      : undefined;

  const investigationPath = rcaReport.investigation_path;

  const getStatusType = (
    status?: 'pending' | 'completed' | 'failed',
  ): 'pending' | 'success' | 'failed' => {
    if (status === 'completed') return 'success';
    return status || 'pending';
  };

  return (
    <>
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
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Box className={classes.infoCardSpacing}>
              <InfoCard
                title={
                  <span className={classes.cardTitle}>
                    <InfoOutlinedIcon className={classes.cardTitleIcon} />
                    Overview
                  </span>
                }
              >
                <Typography variant="body1">{rcaReport.summary}</Typography>
                {isRcaNotPerformed && notPerformedReason && (
                  <Typography variant="body1" style={{ marginTop: 16 }}>
                    {notPerformedReason}
                  </Typography>
                )}
              </InfoCard>
            </Box>
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
            {recommendations?.actions && recommendations.actions.length > 0 && (
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
                  <RecommendationsSection actions={recommendations.actions} />
                </InfoCard>
              </Box>
            )}
            {recommendations?.monitoring_improvements &&
              recommendations.monitoring_improvements.length > 0 && (
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
                    improvements={recommendations.monitoring_improvements}
                  />
                </InfoCard>
              )}
          </Grid>

          <Grid item xs={12} md={4}>
            <Box className={classes.infoCardSpacing}>
              <InfoCard
                title={
                  <span className={classes.cardTitle}>
                    <DescriptionOutlinedIcon
                      className={classes.cardTitleIcon}
                    />
                    Report Summary
                  </span>
                }
              >
                <Box className={classes.summaryRow}>
                  <Typography className={classes.summaryLabel}>
                    Alert ID
                  </Typography>
                  <Tooltip title={alertId} placement="top">
                    <Typography className={classes.summaryValue}>
                      {alertId}
                    </Typography>
                  </Tooltip>
                </Box>
                {report.timestamp && (
                  <Box className={classes.summaryRow}>
                    <Typography className={classes.summaryLabel}>
                      Timestamp
                    </Typography>
                    <Tooltip
                      title={formatTimestamp(report.timestamp)}
                      placement="top"
                    >
                      <Typography className={classes.summaryValue}>
                        {formatTimestamp(report.timestamp)}
                      </Typography>
                    </Tooltip>
                  </Box>
                )}
                {report.status && (
                  <Box className={classes.summaryRow}>
                    <Typography className={classes.summaryLabel}>
                      Status
                    </Typography>
                    <StatusBadge status={getStatusType(report.status)} />
                  </Box>
                )}
              </InfoCard>
            </Box>
            {timeline && (
              <Box className={classes.infoCardSpacing}>
                <InfoCard
                  title={
                    <span className={classes.cardTitle}>
                      <TimelineOutlinedIcon className={classes.cardTitleIcon} />
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
    </>
  );
};
