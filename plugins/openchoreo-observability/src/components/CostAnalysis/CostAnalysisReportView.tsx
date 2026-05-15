import {
  Typography,
  Grid,
  Box,
  IconButton,
  Button,
  makeStyles,
} from '@material-ui/core';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { InfoCard } from '@backstage/core-components';
import AttachMoneyOutlinedIcon from '@material-ui/icons/AttachMoneyOutlined';
import TimelineOutlinedIcon from '@material-ui/icons/TimelineOutlined';
import TrendingUpOutlinedIcon from '@material-ui/icons/TrendingUpOutlined';
import AssignmentOutlinedIcon from '@material-ui/icons/AssignmentOutlined';
import { FinOpsReportDetailed } from '../../types';
import { FormattedText } from '../RCA/RCAReport/FormattedText';
import { FinOpsApplyButton } from './FinOpsApplyButton';
import type { FinOpsAgentApi } from '../../api/FinOpsAgentApi';

const useStyles = makeStyles(theme => ({
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2, 3),
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  backButton: {
    padding: theme.spacing(1),
  },
  titleContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontWeight: 500,
  },
  subtitle: {
    color: theme.palette.text.secondary,
  },
  content: {
    padding: theme.spacing(3),
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(1.5, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  metricLabel: {
    color: theme.palette.text.secondary,
  },
  metricValue: {
    fontWeight: 500,
  },
  costComparison: {
    display: 'flex',
    gap: theme.spacing(3),
  },
  costBox: {
    flex: 1,
    padding: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
  },
  costHeader: {
    marginBottom: theme.spacing(1.5),
    fontWeight: 500,
  },
  costTotal: {
    fontSize: '1.5rem',
    fontWeight: 600,
    marginTop: theme.spacing(1),
  },
  overBudget: {
    color: theme.palette.error.main,
  },
  underBudget: {
    color: theme.palette.success.main,
  },
  stepItem: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: theme.shape.borderRadius,
    '&:last-child': {
      marginBottom: 0,
    },
  },
  stepHeader: {
    fontWeight: 500,
    marginBottom: theme.spacing(1),
  },
  recommendationBox: {
    padding: theme.spacing(2),
    backgroundColor: theme.palette.action.hover,
    borderRadius: theme.shape.borderRadius,
    marginBottom: theme.spacing(2),
  },
  savingsHighlight: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: theme.palette.success.main,
    marginTop: theme.spacing(1),
  },
}));

interface FinOpsApplyChatContextProp {
  backendBaseUrl?: string;
  namespaceName: string;
  environmentName: string;
  finopsAgentApi: FinOpsAgentApi;
}

interface CostAnalysisReportViewProps {
  report: FinOpsReportDetailed;
  reportId: string;
  onBack: () => void;
  componentUrl?: string;
  metricsUrl?: string;
  chatContext?: FinOpsApplyChatContextProp;
  onRecommendationApplied?: () => void;
}

export const CostAnalysisReportView = ({
  report,
  reportId,
  onBack,
  componentUrl,
  metricsUrl,
  chatContext,
  onRecommendationApplied,
}: CostAnalysisReportViewProps) => {
  const classes = useStyles();

  const formatTimestamp = (timestamp?: string): string => {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return timestamp;
    }
  };

  const formatCost = (cost: number, currency: string): string => {
    return `${currency} ${cost.toFixed(2)}`;
  };

  const costAnalysis = report.report;

  if (!costAnalysis) {
    return (
      <Box>
        <Box className={classes.header}>
          <Box className={classes.headerLeft}>
            <IconButton
              onClick={onBack}
              size="small"
              className={classes.backButton}
              title="Back to cost analysis reports"
            >
              <ArrowBackIcon />
            </IconButton>
            <Box className={classes.titleContainer}>
              <Typography variant="h5" className={classes.title}>
                Cost Analysis Report
              </Typography>
              <Typography variant="body2" className={classes.subtitle}>
                {reportId}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Box className={classes.content}>
          <Typography variant="h6" gutterBottom>
            Report content not available
          </Typography>
          <Typography variant="body2" color="textSecondary">
            The cost analysis report is not yet complete or not available.
          </Typography>
        </Box>
      </Box>
    );
  }

  const budgetCost = costAnalysis.budgeted_cost;
  const actualCost = costAnalysis.actual_cost;
  const isOverBudget = actualCost.total_cost > budgetCost.total_cost;
  const costDifference = actualCost.total_cost - budgetCost.total_cost;

  return (
    <Box>
      <Box className={classes.header}>
        <Box className={classes.headerLeft}>
          <IconButton
            onClick={onBack}
            size="small"
            className={classes.backButton}
            title="Back to cost analysis reports"
          >
            <ArrowBackIcon />
          </IconButton>
          <Box className={classes.titleContainer}>
            <Typography variant="h5" className={classes.title}>
              Cost Analysis Report
            </Typography>
            <Typography variant="body2" className={classes.subtitle}>
              {formatTimestamp(report.timestamp)}
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box className={classes.content}>
        <Grid container spacing={3}>
          {/* Overview Section */}
          <Grid item xs={12}>
            <InfoCard
              title={
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  width="100%"
                >
                  <Typography variant="h6">Overview</Typography>
                  {componentUrl && (
                    <Button
                      variant="outlined"
                      size="small"
                      color="primary"
                      onClick={() =>
                        window.open(
                          componentUrl,
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                    >
                      View component
                    </Button>
                  )}
                </Box>
              }
            >
              <Box className={classes.metricRow}>
                <Typography className={classes.metricLabel}>
                  Report ID
                </Typography>
                <Typography className={classes.metricValue}>
                  {reportId}
                </Typography>
              </Box>
              <Box className={classes.metricRow}>
                <Typography className={classes.metricLabel}>
                  Component
                </Typography>
                <Typography className={classes.metricValue}>
                  {costAnalysis.component}
                </Typography>
              </Box>
              <Box className={classes.metricRow}>
                <Typography className={classes.metricLabel}>Project</Typography>
                <Typography className={classes.metricValue}>
                  {costAnalysis.project}
                </Typography>
              </Box>
              <Box className={classes.metricRow}>
                <Typography className={classes.metricLabel}>
                  Namespace
                </Typography>
                <Typography className={classes.metricValue}>
                  {costAnalysis.namespace}
                </Typography>
              </Box>
              {report.environment && (
                <Box className={classes.metricRow}>
                  <Typography className={classes.metricLabel}>
                    Environment
                  </Typography>
                  <Typography className={classes.metricValue}>
                    {report.environment}
                  </Typography>
                </Box>
              )}
              <Box className={classes.metricRow}>
                <Typography className={classes.metricLabel}>
                  Analysis Period
                </Typography>
                <Typography className={classes.metricValue}>
                  {costAnalysis.analysis_period}
                </Typography>
              </Box>
            </InfoCard>
          </Grid>

          {/* Budget vs Actual Section */}
          <Grid item xs={12}>
            <InfoCard
              title={
                <Box className={classes.sectionTitle}>
                  <AttachMoneyOutlinedIcon />
                  <Typography variant="h6">Budget vs Actual Cost</Typography>
                </Box>
              }
            >
              <Box className={classes.costComparison}>
                <Box className={classes.costBox}>
                  <Typography
                    variant="subtitle2"
                    className={classes.costHeader}
                  >
                    Budgeted Cost
                  </Typography>
                  <Typography className={classes.costTotal}>
                    {formatCost(budgetCost.total_cost, budgetCost.currency)}
                  </Typography>
                </Box>

                <Box className={classes.costBox}>
                  <Typography
                    variant="subtitle2"
                    className={classes.costHeader}
                  >
                    Actual Cost
                  </Typography>
                  <Typography
                    className={`${classes.costTotal} ${
                      isOverBudget ? classes.overBudget : classes.underBudget
                    }`}
                  >
                    {formatCost(actualCost.total_cost, actualCost.currency)}
                  </Typography>
                  <Typography
                    variant="caption"
                    className={
                      isOverBudget ? classes.overBudget : classes.underBudget
                    }
                  >
                    {isOverBudget ? '+' : ''}
                    {formatCost(
                      Math.abs(costDifference),
                      actualCost.currency,
                    )}{' '}
                    {isOverBudget ? 'over budget' : 'under budget'}
                  </Typography>
                </Box>
              </Box>
            </InfoCard>
          </Grid>

          {/* Resource Metrics Section */}
          {costAnalysis.resource_metrics.data_available && (
            <Grid item xs={12}>
              <InfoCard
                title={
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                    width="100%"
                  >
                    <Box className={classes.sectionTitle}>
                      <TimelineOutlinedIcon />
                      <Typography variant="h6">Resource Metrics</Typography>
                    </Box>
                    {metricsUrl && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="primary"
                        onClick={() =>
                          window.open(
                            metricsUrl,
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                      >
                        View metrics
                      </Button>
                    )}
                  </Box>
                }
              >
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      CPU
                    </Typography>
                    <Box className={classes.metricRow}>
                      <Typography className={classes.metricLabel}>
                        Request
                      </Typography>
                      <Typography>
                        {costAnalysis.resource_metrics.cpu_request || 'N/A'}
                      </Typography>
                    </Box>
                    <Box className={classes.metricRow}>
                      <Typography className={classes.metricLabel}>
                        Limit
                      </Typography>
                      <Typography>
                        {costAnalysis.resource_metrics.cpu_limit || 'N/A'}
                      </Typography>
                    </Box>
                    <Box className={classes.metricRow}>
                      <Typography className={classes.metricLabel}>
                        Actual (Avg)
                      </Typography>
                      <Typography>
                        {costAnalysis.resource_metrics.cpu_actual_avg || 'N/A'}
                      </Typography>
                    </Box>
                    <Box className={classes.metricRow}>
                      <Typography className={classes.metricLabel}>
                        Actual (Peak)
                      </Typography>
                      <Typography>
                        {costAnalysis.resource_metrics.cpu_actual_peak || 'N/A'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="subtitle2" gutterBottom>
                      Memory
                    </Typography>
                    <Box className={classes.metricRow}>
                      <Typography className={classes.metricLabel}>
                        Request
                      </Typography>
                      <Typography>
                        {costAnalysis.resource_metrics.memory_request || 'N/A'}
                      </Typography>
                    </Box>
                    <Box className={classes.metricRow}>
                      <Typography className={classes.metricLabel}>
                        Limit
                      </Typography>
                      <Typography>
                        {costAnalysis.resource_metrics.memory_limit || 'N/A'}
                      </Typography>
                    </Box>
                    <Box className={classes.metricRow}>
                      <Typography className={classes.metricLabel}>
                        Actual (Avg)
                      </Typography>
                      <Typography>
                        {costAnalysis.resource_metrics.memory_actual_avg ||
                          'N/A'}
                      </Typography>
                    </Box>
                    <Box className={classes.metricRow}>
                      <Typography className={classes.metricLabel}>
                        Actual (Peak)
                      </Typography>
                      <Typography>
                        {costAnalysis.resource_metrics.memory_actual_peak ||
                          'N/A'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </InfoCard>
            </Grid>
          )}

          {/* Overprovisioning Analysis Section */}
          <Grid item xs={12}>
            <InfoCard
              title={
                <Box className={classes.sectionTitle}>
                  <TrendingUpOutlinedIcon />
                  <Typography variant="h6">
                    Overprovisioning Analysis
                  </Typography>
                </Box>
              }
            >
              <Box className={classes.metricRow}>
                <Typography className={classes.metricLabel}>Status</Typography>
                <Typography
                  className={
                    costAnalysis.overprovisioning.is_overprovisioned
                      ? classes.overBudget
                      : classes.underBudget
                  }
                  style={{ fontWeight: 500 }}
                >
                  {costAnalysis.overprovisioning.is_overprovisioned
                    ? 'Overprovisioned'
                    : 'Appropriately Provisioned'}
                </Typography>
              </Box>
              {typeof costAnalysis.overprovisioning.cpu_utilization_pct ===
                'number' && (
                <Box className={classes.metricRow}>
                  <Typography className={classes.metricLabel}>
                    CPU Utilization
                  </Typography>
                  <Typography>
                    {costAnalysis.overprovisioning.cpu_utilization_pct.toFixed(
                      1,
                    )}
                    %
                  </Typography>
                </Box>
              )}
              {typeof costAnalysis.overprovisioning.memory_utilization_pct ===
                'number' && (
                <Box className={classes.metricRow}>
                  <Typography className={classes.metricLabel}>
                    Memory Utilization
                  </Typography>
                  <Typography>
                    {costAnalysis.overprovisioning.memory_utilization_pct.toFixed(
                      1,
                    )}
                    %
                  </Typography>
                </Box>
              )}
              <Box mt={2}>
                <Typography variant="body2">
                  <FormattedText
                    text={costAnalysis.overprovisioning.analysis}
                  />
                </Typography>
              </Box>
            </InfoCard>
          </Grid>

          {/* Recommendation Section */}
          {costAnalysis.overprovisioning.recommendation && (
            <Grid item xs={12}>
              <InfoCard
                title={
                  <Box className={classes.sectionTitle}>
                    <AssignmentOutlinedIcon />
                    <Typography variant="h6">Recommendation</Typography>
                  </Box>
                }
              >
                <Box className={classes.recommendationBox}>
                  <Typography variant="subtitle2" gutterBottom>
                    Recommended Resource Configuration
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Box className={classes.metricRow}>
                        <Typography className={classes.metricLabel}>
                          CPU Request
                        </Typography>
                        <Typography>
                          {
                            costAnalysis.overprovisioning.recommendation
                              .cpu_request
                          }
                        </Typography>
                      </Box>
                      <Box className={classes.metricRow}>
                        <Typography className={classes.metricLabel}>
                          CPU Limit
                        </Typography>
                        <Typography>
                          {
                            costAnalysis.overprovisioning.recommendation
                              .cpu_limit
                          }
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Box className={classes.metricRow}>
                        <Typography className={classes.metricLabel}>
                          Memory Request
                        </Typography>
                        <Typography>
                          {
                            costAnalysis.overprovisioning.recommendation
                              .memory_request
                          }
                        </Typography>
                      </Box>
                      <Box className={classes.metricRow}>
                        <Typography className={classes.metricLabel}>
                          Memory Limit
                        </Typography>
                        <Typography>
                          {
                            costAnalysis.overprovisioning.recommendation
                              .memory_limit
                          }
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
                <Typography variant="body2" style={{ marginTop: '16px' }}>
                  <FormattedText
                    text={
                      costAnalysis.overprovisioning.recommendation.rationale
                    }
                  />
                </Typography>
                {(() => {
                  const action = costAnalysis.recommended_actions?.[0];
                  if (!action?.change || !chatContext) return null;
                  return (
                    <Box mt={2}>
                      <FinOpsApplyButton
                        reportId={reportId}
                        actionIndex={0}
                        action={action}
                        chatContext={chatContext}
                        onApplied={onRecommendationApplied}
                      />
                    </Box>
                  );
                })()}
              </InfoCard>
            </Grid>
          )}

          {/* Investigation Path Section */}
          {costAnalysis.investigation_path &&
            costAnalysis.investigation_path.length > 0 && (
              <Grid item xs={12}>
                <InfoCard
                  title={
                    <Box className={classes.sectionTitle}>
                      <TimelineOutlinedIcon />
                      <Typography variant="h6">Investigation Path</Typography>
                    </Box>
                  }
                >
                  {costAnalysis.investigation_path.map((step, index) => (
                    <Box key={index} className={classes.stepItem}>
                      <Typography
                        variant="subtitle2"
                        className={classes.stepHeader}
                      >
                        Step {index + 1}: {step.action}
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        <strong>Outcome:</strong> {step.outcome}
                      </Typography>
                      {step.rationale && (
                        <Typography variant="body2" color="textSecondary">
                          <strong>Rationale:</strong> {step.rationale}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </InfoCard>
              </Grid>
            )}

          {/* Summary Section */}
          <Grid item xs={12}>
            <InfoCard title="Summary">
              <Typography variant="body1">
                <FormattedText text={costAnalysis.summary} />
              </Typography>
            </InfoCard>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};
