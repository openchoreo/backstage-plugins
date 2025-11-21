import type { FC } from 'react';
import {
  Typography,
  Box,
  Grid,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { alpha } from '@material-ui/core/styles/colorManipulator';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

const useStyles = makeStyles(theme => ({
  section: {
    marginBottom: theme.spacing(3),
  },
  sectionTitle: {
    fontSize: theme.typography.h5.fontSize,
    fontWeight: 600,
    marginBottom: theme.spacing(2),
    color: theme.palette.text.primary,
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
    minWidth: '140px',
  },
  propertyValue: {
    color: theme.palette.text.primary,
    fontSize: theme.typography.body2.fontSize,
    wordBreak: 'break-word',
  },
  propertyValueCode: {
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.05,
    ),
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.spacing(0.5),
    fontSize: '0.875rem',
    fontFamily: 'monospace',
  },
  resourceCard: {
    padding: theme.spacing(2),
    backgroundColor: alpha(theme.palette.background.paper, 0.6),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    marginBottom: theme.spacing(2),
  },
  resourceHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  resourceKind: {
    fontWeight: 600,
    fontSize: theme.typography.body1.fontSize,
  },
  healthyChip: {
    backgroundColor: theme.palette.success.light,
    color: theme.palette.success.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  progressingChip: {
    backgroundColor: theme.palette.info.light,
    color: theme.palette.info.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  degradedChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  suspendedChip: {
    backgroundColor: theme.palette.warning.light,
    color: theme.palette.warning.dark,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  unknownChip: {
    backgroundColor: alpha(theme.palette.text.disabled, 0.1),
    color: theme.palette.text.secondary,
    fontWeight: 500,
    fontSize: '0.75rem',
  },
  conditionRow: {
    padding: theme.spacing(1.5),
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.02,
    ),
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  emptyValue: {
    color: theme.palette.text.disabled,
    fontStyle: 'italic',
    fontSize: theme.typography.body2.fontSize,
  },
  accordion: {
    backgroundColor: alpha(
      theme.palette.type === 'dark'
        ? theme.palette.common.white
        : theme.palette.common.black,
      0.02,
    ),
    '&:before': {
      display: 'none',
    },
    boxShadow: 'none',
    border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
    marginBottom: theme.spacing(1),
  },
}));

interface ReleaseDataRendererProps {
  releaseData: {
    data?: {
      spec?: {
        owner?: {
          projectName?: string;
          componentName?: string;
        };
        environmentName?: string;
        resources?: Array<{
          id: string;
          object: any;
        }>;
        interval?: string;
        progressingInterval?: string;
      };
      status?: {
        resources?: Array<{
          id: string;
          group?: string;
          version: string;
          kind: string;
          name: string;
          namespace?: string;
          status?: any;
          healthStatus?:
            | 'Unknown'
            | 'Progressing'
            | 'Healthy'
            | 'Suspended'
            | 'Degraded';
          lastObservedTime?: string;
        }>;
        conditions?: Array<{
          type: string;
          status: string;
          lastTransitionTime?: string;
          reason?: string;
          message?: string;
        }>;
      };
    };
  };
}

export const ReleaseDataRenderer: FC<ReleaseDataRendererProps> = ({
  releaseData,
}) => {
  const classes = useStyles();
  const data = releaseData?.data;

  if (!data || (!data.spec && !data.status)) {
    return (
      <Typography className={classes.emptyValue}>
        No release data available
      </Typography>
    );
  }

  const getHealthChipClass = (healthStatus?: string) => {
    switch (healthStatus) {
      case 'Healthy':
        return classes.healthyChip;
      case 'Progressing':
        return classes.progressingChip;
      case 'Degraded':
        return classes.degradedChip;
      case 'Suspended':
        return classes.suspendedChip;
      default:
        return classes.unknownChip;
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'N/A';
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <Box>
      {/* Overview Section */}
      {data.spec && (
        <Box className={classes.section}>
          <Typography className={classes.sectionTitle}>Overview</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>
                  Environment:
                </Typography>
                <Typography className={classes.propertyValue}>
                  {data.spec.environmentName || 'N/A'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>
                  Project:
                </Typography>
                <Typography className={classes.propertyValue}>
                  {data.spec.owner?.projectName || 'N/A'}
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box className={classes.propertyRow}>
                <Typography className={classes.propertyKey}>
                  Component:
                </Typography>
                <Typography className={classes.propertyValue}>
                  {data.spec.owner?.componentName || 'N/A'}
                </Typography>
              </Box>
            </Grid>
            {data.spec.interval && (
              <Grid item xs={12} sm={6}>
                <Box className={classes.propertyRow}>
                  <Typography className={classes.propertyKey}>
                    Watch Interval:
                  </Typography>
                  <Typography className={classes.propertyValueCode}>
                    {data.spec.interval}
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </Box>
      )}

      {/* Resources Section */}
      {data.status?.resources && data.status.resources.length > 0 && (
        <Box className={classes.section}>
          <Typography className={classes.sectionTitle}>
            Resources ({data.status.resources.length})
          </Typography>
          {data.status.resources.map((resource, index) => (
            <Box key={resource.id || index} className={classes.resourceCard}>
              <Box className={classes.resourceHeader}>
                <Typography className={classes.resourceKind}>
                  {resource.kind}
                </Typography>
                {resource.healthStatus && (
                  <Chip
                    label={resource.healthStatus}
                    size="small"
                    className={getHealthChipClass(resource.healthStatus)}
                  />
                )}
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <Box className={classes.propertyRow}>
                    <Typography className={classes.propertyKey}>
                      Name:
                    </Typography>
                    <Typography className={classes.propertyValueCode}>
                      {resource.name}
                    </Typography>
                  </Box>
                </Grid>
                {resource.namespace && (
                  <Grid item xs={12} sm={6}>
                    <Box className={classes.propertyRow}>
                      <Typography className={classes.propertyKey}>
                        Namespace:
                      </Typography>
                      <Typography className={classes.propertyValueCode}>
                        {resource.namespace}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <Box className={classes.propertyRow}>
                    <Typography className={classes.propertyKey}>
                      API Version:
                    </Typography>
                    <Typography className={classes.propertyValueCode}>
                      {resource.group
                        ? `${resource.group}/${resource.version}`
                        : resource.version}
                    </Typography>
                  </Box>
                </Grid>
                {resource.lastObservedTime && (
                  <Grid item xs={12} sm={6}>
                    <Box className={classes.propertyRow}>
                      <Typography className={classes.propertyKey}>
                        Last Observed:
                      </Typography>
                      <Typography className={classes.propertyValue}>
                        {formatTimestamp(resource.lastObservedTime)}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
              {resource.status && Object.keys(resource.status).length > 0 && (
                <Box style={{ marginTop: '12px' }}>
                  <Accordion className={classes.accordion}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body2" style={{ fontWeight: 500 }}>
                        Resource Status Details
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <pre
                        style={{
                          margin: 0,
                          fontSize: '0.75rem',
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {JSON.stringify(resource.status, null, 2)}
                      </pre>
                    </AccordionDetails>
                  </Accordion>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Conditions Section */}
      {data.status?.conditions && data.status.conditions.length > 0 && (
        <Box className={classes.section}>
          <Typography className={classes.sectionTitle}>Conditions</Typography>
          {data.status.conditions.map((condition, index) => (
            <Box key={index} className={classes.conditionRow}>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={4}>
                  <Box className={classes.propertyRow}>
                    <Typography className={classes.propertyKey}>
                      Type:
                    </Typography>
                    <Typography className={classes.propertyValue}>
                      {condition.type}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box className={classes.propertyRow}>
                    <Typography className={classes.propertyKey}>
                      Status:
                    </Typography>
                    <Typography className={classes.propertyValue}>
                      {condition.status}
                    </Typography>
                  </Box>
                </Grid>
                {condition.lastTransitionTime && (
                  <Grid item xs={12} sm={4}>
                    <Box className={classes.propertyRow}>
                      <Typography className={classes.propertyKey}>
                        Last Transition:
                      </Typography>
                      <Typography className={classes.propertyValue}>
                        {formatTimestamp(condition.lastTransitionTime)}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {condition.reason && (
                  <Grid item xs={12}>
                    <Box className={classes.propertyRow}>
                      <Typography className={classes.propertyKey}>
                        Reason:
                      </Typography>
                      <Typography className={classes.propertyValue}>
                        {condition.reason}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {condition.message && (
                  <Grid item xs={12}>
                    <Box className={classes.propertyRow}>
                      <Typography className={classes.propertyKey}>
                        Message:
                      </Typography>
                      <Typography className={classes.propertyValue}>
                        {condition.message}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>
            </Box>
          ))}
        </Box>
      )}

      {/* Spec Resources Section (for reference) */}
      {data.spec?.resources && data.spec.resources.length > 0 && (
        <Box className={classes.section}>
          <Typography className={classes.sectionTitle}>
            Resource Definitions ({data.spec.resources.length})
          </Typography>
          {data.spec.resources.map((resource, index) => (
            <Accordion key={resource.id || index} className={classes.accordion}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2" style={{ fontWeight: 500 }}>
                  {resource.id}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <pre
                  style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(resource.object, null, 2)}
                </pre>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
};
