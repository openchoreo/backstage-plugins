import { Typography, Box, Grid, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import { BuildStatusChip } from '../BuildStatusChip';
import { useWorkflowRun } from '../hooks';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles(theme => ({
  metadataCard: {
    padding: theme.spacing(2),
    backgroundColor: alpha(theme.palette.background.paper, 0.6),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  propertyRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  propertyKey: {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: theme.typography.caption.fontSize,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    minWidth: '120px',
  },
  propertyValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
  },
  commitValue: {
    fontFamily: 'monospace',
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.05,
    ),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.spacing(0.5),
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },
}));

interface RunMetadataContentProps {
  build: ModelsBuild;
}

export const RunMetadataContent = ({ build }: RunMetadataContentProps) => {
  const classes = useStyles();
  const {
    workflowRun: workflowRunDetails,
    loading,
    error,
  } = useWorkflowRun(build.name);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Box className={classes.loadingContainer}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={classes.metadataCard}>
        <Typography color="error">
          Failed to load workflow run details: {error.message}
        </Typography>
      </Box>
    );
  }

  const workflowData = workflowRunDetails || build;

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Box className={classes.metadataCard}>
            <Typography variant="h6" gutterBottom>
              Build Information
            </Typography>

            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Name:</Typography>
              <Typography className={classes.propertyValue}>
                {workflowData.name || 'N/A'}
              </Typography>
            </Box>

            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Status:</Typography>
              <BuildStatusChip status={workflowData.status} />
            </Box>

            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Commit:</Typography>
              <Typography
                className={`${classes.propertyValue} ${classes.commitValue}`}
              >
                {workflowData.commit || 'N/A'}
              </Typography>
            </Box>

            {workflowRunDetails?.workflow?.name && (
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>
                  Workflow:
                </Typography>
                <Typography className={classes.propertyValue}>
                  {workflowRunDetails.workflow.name}
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} md={6}>
          <Box className={classes.metadataCard}>
            <Typography variant="h6" gutterBottom>
              Timestamps
            </Typography>

            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Created:</Typography>
              <Typography className={classes.propertyValue}>
                {formatDate(workflowData.createdAt)}
              </Typography>
            </Box>

            {workflowData.image && (
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>Image:</Typography>
                <Typography
                  className={`${classes.propertyValue} ${classes.commitValue}`}
                >
                  {workflowData.image}
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>

        {workflowRunDetails?.workflow?.systemParameters && (
          <Grid item xs={12} md={6}>
            <Box className={classes.metadataCard}>
              <Typography variant="h6" gutterBottom>
                System Parameters
              </Typography>

              {workflowRunDetails.workflow.systemParameters.repository && (
                <>
                  <Box className={classes.propertyRow}>
                    <Typography className={classes.propertyKey}>
                      Repository URL:
                    </Typography>
                    <Typography className={classes.propertyValue}>
                      {workflowRunDetails.workflow.systemParameters.repository
                        .url || 'N/A'}
                    </Typography>
                  </Box>

                  <Box className={classes.propertyRow}>
                    <Typography className={classes.propertyKey}>
                      App Path:
                    </Typography>
                    <Typography className={classes.propertyValue}>
                      {workflowRunDetails.workflow.systemParameters.repository
                        .appPath || 'N/A'}
                    </Typography>
                  </Box>

                  {workflowRunDetails.workflow.systemParameters.repository
                    .revision && (
                    <>
                      <Box className={classes.propertyRow}>
                        <Typography className={classes.propertyKey}>
                          Branch:
                        </Typography>
                        <Typography className={classes.propertyValue}>
                          {workflowRunDetails.workflow.systemParameters
                            .repository.revision.branch || 'N/A'}
                        </Typography>
                      </Box>

                      {workflowRunDetails.workflow.systemParameters.repository
                        .revision.commit && (
                        <Box className={classes.propertyRow}>
                          <Typography className={classes.propertyKey}>
                            Revision Commit:
                          </Typography>
                          <Typography
                            className={`${classes.propertyValue} ${classes.commitValue}`}
                          >
                            {
                              workflowRunDetails.workflow.systemParameters
                                .repository.revision.commit
                            }
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                </>
              )}
            </Box>
          </Grid>
        )}

        {workflowRunDetails?.workflow?.parameters &&
          Object.keys(workflowRunDetails.workflow.parameters).length > 0 && (
            <Grid item xs={12} md={6}>
              <Box className={classes.metadataCard}>
                <Typography variant="h6" gutterBottom>
                  Custom Parameters
                </Typography>
                {Object.entries(workflowRunDetails.workflow.parameters).map(
                  ([key, value]) => (
                    <Box key={key} className={classes.propertyRow}>
                      <Typography className={classes.propertyKey}>
                        {key}:
                      </Typography>
                      <Typography className={classes.propertyValue}>
                        {typeof value === 'object'
                          ? JSON.stringify(value)
                          : String(value)}
                      </Typography>
                    </Box>
                  ),
                )}
              </Box>
            </Grid>
          )}
      </Grid>
    </Box>
  );
};
