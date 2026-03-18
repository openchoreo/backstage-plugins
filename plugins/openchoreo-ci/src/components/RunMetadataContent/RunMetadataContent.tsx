import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  Typography,
  Box,
  Grid,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import FileCopyOutlinedIcon from '@material-ui/icons/FileCopyOutlined';
import CheckIcon from '@material-ui/icons/Check';
import { stringify as yamlStringify } from 'yaml';
import { BuildStatusChip } from '../BuildStatusChip';
import { useWorkflowRun } from '../../hooks';
import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';
import { extractGitFieldValues } from '../../utils/schemaExtensions';
import type { GitFieldMapping } from '../../utils/schemaExtensions';
import { useStyles } from './styles';

const TERMINAL_STATUSES = ['Succeeded', 'Failed', 'Error'];

interface RunMetadataContentProps {
  build: ModelsBuild;
  gitFieldMapping?: GitFieldMapping;
}

function parseWorkloadCr(workloadCr: string | undefined) {
  if (!workloadCr) return null;
  try {
    return JSON.parse(workloadCr);
  } catch {
    return null;
  }
}

function calculateDuration(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return null;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function CopyButton({
  text,
  tooltip = 'Copy to clipboard',
  className,
}: {
  text: string;
  tooltip?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }, [text]);

  return (
    <Tooltip title={copied ? 'Copied!' : tooltip}>
      <IconButton size="small" className={className} onClick={handleCopy}>
        {copied ? (
          <CheckIcon fontSize="small" color="primary" />
        ) : (
          <FileCopyOutlinedIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}

export const RunMetadataContent = ({
  build,
  gitFieldMapping,
}: RunMetadataContentProps) => {
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

  const isTerminal =
    !!workflowRunDetails?.completedAt ||
    TERMINAL_STATUSES.includes(workflowData.status || '');
  const parsedWorkload = parseWorkloadCr(workflowRunDetails?.workloadCr);
  const workloadImage = parsedWorkload?.spec?.container?.image ?? null;
  const duration = calculateDuration(
    workflowRunDetails?.startedAt,
    workflowRunDetails?.completedAt,
  );

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Build Information */}
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
                className={`${classes.propertyValue} ${classes.monoValue}`}
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

        {/* Timestamps */}
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

            <Box className={classes.propertyRow}>
              <Typography className={classes.propertyKey}>Started:</Typography>
              <Typography className={classes.propertyValue}>
                {formatDate(workflowRunDetails?.startedAt)}
              </Typography>
            </Box>

            {isTerminal && (
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>
                  Completed:
                </Typography>
                <Typography className={classes.propertyValue}>
                  {formatDate(workflowRunDetails?.completedAt)}
                </Typography>
              </Box>
            )}

            {isTerminal && duration && (
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>
                  Duration:
                </Typography>
                <Typography className={classes.propertyValue}>
                  {duration}
                </Typography>
              </Box>
            )}
          </Box>
        </Grid>

        {/* Workload */}
        <Grid item xs={12} md={6}>
          <Box className={classes.metadataCard}>
            <Typography variant="h6" gutterBottom>
              Workload
            </Typography>

            {!isTerminal && (
              <Typography variant="body2" color="textSecondary">
                Workload details will be available once the workflow run
                completes.
              </Typography>
            )}

            {isTerminal && !workflowRunDetails?.workloadCr && (
              <Typography variant="body2" color="textSecondary">
                Workload details are not found in the workflow run.
              </Typography>
            )}

            {isTerminal && workflowRunDetails?.workloadCr && (
              <>
                <Box className={classes.propertyRow}>
                  <Typography className={classes.propertyKey}>
                    From Source:
                  </Typography>
                  <Typography className={classes.propertyValue}>
                    {workflowRunDetails.workloadFromSource === 'true'
                      ? 'Yes'
                      : 'No'}
                  </Typography>
                </Box>

                {workloadImage && (
                  <Box className={classes.propertyRow}>
                    <Typography className={classes.propertyKey}>
                      Image:
                    </Typography>
                    <Box className={classes.copyableRow}>
                      <Typography
                        className={`${classes.propertyValue} ${classes.monoValue}`}
                      >
                        {workloadImage}
                      </Typography>
                      <CopyButton
                        text={workloadImage}
                        tooltip="Copy image"
                        className={classes.copyButton}
                      />
                    </Box>
                  </Box>
                )}

                <Typography className={classes.propertyKey}>
                  Workload CR
                </Typography>

                {parsedWorkload && (
                  <Box className={classes.codeBlockWrapper}>
                    <CopyButton
                      text={yamlStringify(parsedWorkload, {
                        lineWidth: 0,
                      }).trimEnd()}
                      tooltip="Copy workload CR"
                      className={classes.codeBlockCopyButton}
                    />
                    <pre className={classes.codeBlock}>
                      {yamlStringify(parsedWorkload, {
                        lineWidth: 0,
                      }).trimEnd()}
                    </pre>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Grid>

        {/* Workflow Parameters */}
        {workflowRunDetails?.workflow?.parameters &&
          Object.keys(workflowRunDetails.workflow.parameters).length > 0 && (
            <Grid item xs={12} md={6}>
              <Box className={classes.metadataCard}>
                <Typography variant="h6" gutterBottom>
                  Workflow Parameters
                </Typography>
                <Box className={classes.codeBlockWrapper}>
                  <CopyButton
                    text={yamlStringify(
                      workflowRunDetails.workflow.parameters,
                      { lineWidth: 0 },
                    ).trimEnd()}
                    tooltip="Copy parameters"
                    className={classes.codeBlockCopyButton}
                  />
                  <pre className={classes.codeBlock}>
                    {yamlStringify(workflowRunDetails.workflow.parameters, {
                      lineWidth: 0,
                    }).trimEnd()}
                  </pre>
                </Box>
              </Box>
            </Grid>
          )}
      </Grid>
    </Box>
  );
};
