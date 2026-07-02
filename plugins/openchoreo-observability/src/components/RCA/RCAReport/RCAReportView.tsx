import { useEffect, useMemo, useState } from 'react';
import { Typography, Grid, Box, IconButton, Button } from '@material-ui/core';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import AutorenewIcon from '@material-ui/icons/Autorenew';
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
import { RCAChatDrawer } from './sections/RCAChatDrawer';
import { QuickFixesPanelSection } from './sections/QuickFixesPanelSection';
import { allActionsResolved } from './sections/PatchTabContent';
import { useRCAReportStyles } from './styles';
import { EntityLinkContext } from './EntityLinkContext';
import type { AIRCAAgentComponents } from '@openchoreo/backstage-plugin-common';
import type { RCAAgentApi, RecommendedAction } from '../../../api/RCAAgentApi';

type RCAReportDetailed = AIRCAAgentComponents['schemas']['RCAReportDetailed'];

interface ChatContext {
  namespaceName: string;
  environmentName: string;
  projectName: string;
  rcaAgentApi: RCAAgentApi;
  backendBaseUrl?: string;
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

  // Compute revised actions from the report
  const revisedActions = useMemo(() => {
    const result: { index: number; action: RecommendedAction }[] = [];
    const recs = (() => {
      const r = report.report?.result;
      if (r?.type === 'root_cause_identified') return r.recommendations;
      if (r?.type === 'no_root_cause_identified') return r.recommendations;
      return undefined;
    })();
    const actions = recs?.recommended_actions;
    if (actions) {
      actions.forEach((action, idx) => {
        if (
          (action.status === 'revised' ||
            action.status === 'applied' ||
            action.status === 'dismissed') &&
          action.change
        ) {
          result.push({ index: idx, action });
        }
      });
    }
    return result;
  }, [report]);

  const hasRevised = revisedActions.length > 0;

  const [activePanel, setActivePanel] = useState<'fixes' | null>(null);

  // Keep the panel in sync with the current report's recommendations.
  // Runs on mount and whenever the revised-actions set changes, so the
  // panel reflects the latest report data. It does not fight the manual
  // Quick Fixes toggle below: clicking that button changes neither
  // hasRevised nor revisedActions, so this effect won't re-run.
  useEffect(() => {
    if (!hasRevised || allActionsResolved(revisedActions)) {
      setActivePanel(null);
      return;
    }
    setActivePanel('fixes');
  }, [hasRevised, revisedActions]);

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

  const namespaceValue = useMemo(
    () => ({ namespace: chatContext.namespaceName }),
    [chatContext.namespaceName],
  );

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
    <EntityLinkContext.Provider value={namespaceValue}>
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
          {hasRevised && (
            <Box display="flex" style={{ gap: 8 }}>
              <Button
                variant={activePanel === 'fixes' ? 'contained' : 'outlined'}
                color="primary"
                size="small"
                startIcon={<AutorenewIcon />}
                onClick={() =>
                  setActivePanel(prev => (prev === 'fixes' ? null : 'fixes'))
                }
              >
                Quick Fixes
              </Button>
            </Box>
          )}
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
              {activePanel === 'fixes' && (
                <QuickFixesPanelSection
                  reportId={reportId}
                  chatContext={chatContext}
                  revisedActions={revisedActions}
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
        {/* key on reportId: the drawer loads its conversation from storage
            only on mount, so it must remount when the route switches to a
            different report — otherwise the prior report's messages persist
            (and get written back under the new report's key). */}
        <RCAChatDrawer
          key={reportId}
          reportId={reportId}
          chatContext={chatContext}
        />
      </Box>
    </EntityLinkContext.Provider>
  );
};
