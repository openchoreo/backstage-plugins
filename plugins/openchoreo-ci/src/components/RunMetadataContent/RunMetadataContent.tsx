import { useMemo } from 'react';
import { Typography, Box, Grid, CircularProgress } from '@material-ui/core';
import { CodeSnippet } from '@backstage/core-components';
import { stringify as yamlStringify } from 'yaml';
import { BuildStatusChip } from '../BuildStatusChip';
import { useWorkflowRun } from '../../hooks';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { extractGitFieldValues } from '../../utils/schemaExtensions';
import type { GitFieldMapping } from '../../utils/schemaExtensions';
import { useStyles } from './styles';

interface RunMetadataContentProps {
  build: ModelsBuild;
  gitFieldMapping?: GitFieldMapping;
}

export const RunMetadataContent = ({ build, gitFieldMapping }: RunMetadataContentProps) => {
  const classes = useStyles();
  const {
    workflowRun: workflowRunDetails,
    loading,
    error,
  } = useWorkflowRun(build.name);

  const gitValues = useMemo(
    () => extractGitFieldValues(build.parameters, gitFieldMapping ?? {}),
    [build.parameters, gitFieldMapping],
  );

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
  const commitDisplay = gitValues.commit || workflowData.commit || 'N/A';

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
                {commitDisplay}
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

        {workflowRunDetails?.workflow?.parameters &&
          Object.keys(workflowRunDetails.workflow.parameters).length > 0 && (
            <Grid item xs={12}>
              <Box className={classes.metadataCard}>
                <Typography variant="h6" gutterBottom>
                  Workflow Parameters
                </Typography>
                <CodeSnippet
                  language="yaml"
                  text={yamlStringify(
                    workflowRunDetails.workflow.parameters,
                    { lineWidth: 0 },
                  ).trimEnd()}
                  showCopyCodeButton
                />
              </Box>
            </Grid>
          )}
      </Grid>
    </Box>
  );
};
