import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Tooltip,
} from '@material-ui/core';
import { useBuildPermission } from '@openchoreo/backstage-plugin-react';
import { Skeleton } from '@material-ui/lab';
import { Link } from '@backstage/core-components';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import CodeIcon from '@material-ui/icons/Code';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import BuildIcon from '@material-ui/icons/Build';
import BlockIcon from '@material-ui/icons/Block';
import { Card } from '@openchoreo/backstage-design-system';
import { formatRelativeTime } from '@openchoreo/backstage-plugin-react';
import { BuildStatusChip } from '../BuildStatusChip';
import { useWorkflowsSummary } from './useWorkflowsSummary';
import { useOverviewCardStyles } from './styles';

export const WorkflowsOverviewCard = () => {
  const classes = useOverviewCardStyles();
  const {
    latestBuild,
    hasWorkflows,
    loading,
    error,
    triggeringBuild,
    triggerBuild,
  } = useWorkflowsSummary();
  const {
    canBuild,
    triggerLoading: permissionLoading,
    triggerBuildDeniedTooltip: deniedTooltip,
  } = useBuildPermission();

  // Loading state
  if (loading) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Skeleton variant="text" width={100} height={28} />
        </Box>
        <Box className={classes.content}>
          <Skeleton variant="rect" height={60} />
        </Box>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Workflows</Typography>
        </Box>
        <Box className={classes.disabledState}>
          <Typography variant="body2" color="error">
            Failed to load workflow data
          </Typography>
        </Box>
      </Card>
    );
  }

  // Workflows not enabled state
  if (!hasWorkflows) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Workflows</Typography>
        </Box>
        <Box className={classes.disabledState}>
          <BlockIcon className={classes.disabledIcon} />
          <Typography variant="body2">
            Workflows not enabled for this component
          </Typography>
        </Box>
      </Card>
    );
  }

  // No builds yet state
  if (!latestBuild) {
    return (
      <Card padding={16} className={classes.card}>
        <Box className={classes.cardHeader}>
          <Typography className={classes.cardTitle}>Workflows</Typography>
          <Link to="workflows" className={classes.viewLink}>
            View All <ArrowForwardIcon fontSize="small" />
          </Link>
        </Box>
        <Box className={classes.emptyState}>
          <BuildIcon className={classes.disabledIcon} />
          <Typography variant="body2">No builds yet</Typography>
          <Typography variant="caption" color="textSecondary">
            Trigger your first build to get started
          </Typography>
        </Box>
        <Box className={classes.actions}>
          <Tooltip title={deniedTooltip}>
            <span>
              <Button
                variant="outlined"
                color="primary"
                size="small"
                onClick={triggerBuild}
                disabled={triggeringBuild || permissionLoading || !canBuild}
                startIcon={
                  triggeringBuild ? (
                    <CircularProgress size={14} />
                  ) : (
                    <BuildIcon fontSize="small" />
                  )
                }
              >
                {triggeringBuild ? 'Building...' : 'Build Now'}
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Card>
    );
  }

  // Normal state with latest build
  const commitHash = latestBuild.commit
    ? latestBuild.commit.substring(0, 8)
    : null;

  return (
    <Card padding={16} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography className={classes.cardTitle}>Workflows</Typography>
        <Link to="workflows" className={classes.viewLink}>
          View All <ArrowForwardIcon fontSize="small" />
        </Link>
      </Box>

      <Box className={classes.content}>
        <Typography className={classes.sectionLabel}>Latest Build</Typography>
        <Box className={classes.buildInfo}>
          <Box className={classes.buildHeader}>
            <BuildStatusChip status={latestBuild.status} />
            <Typography className={classes.buildName} title={latestBuild.name}>
              {latestBuild.name}
            </Typography>
          </Box>

          <Box className={classes.metaRow}>
            {latestBuild.createdAt && (
              <Box className={classes.metaItem}>
                <AccessTimeIcon className={classes.metaIcon} />
                <span>{formatRelativeTime(latestBuild.createdAt)}</span>
              </Box>
            )}
            {commitHash && (
              <Box className={classes.metaItem}>
                <CodeIcon className={classes.metaIcon} />
                <span className={classes.commitHash}>{commitHash}</span>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      <Box className={classes.actions}>
        <Tooltip title={deniedTooltip}>
          <span>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              onClick={triggerBuild}
              disabled={triggeringBuild || permissionLoading || !canBuild}
              startIcon={
                triggeringBuild ? (
                  <CircularProgress size={14} />
                ) : (
                  <BuildIcon fontSize="small" />
                )
              }
            >
              {triggeringBuild ? 'Building...' : 'Build Now'}
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Card>
  );
};
