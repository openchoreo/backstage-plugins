import { FC } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  makeStyles,
} from '@material-ui/core';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import { Progress } from '@backstage/core-components';
import { Alert } from '@material-ui/lab';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  useRCAReportByAlert,
  useFilters,
  useGetEnvironmentsByOrganization,
} from '../../hooks';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

const useStyles = makeStyles(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 240px)',
    maxHeight: 'calc(100vh - 240px)',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: theme.palette.background.paper,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2, 0),
    borderBottom: `1px solid ${theme.palette.divider}`,
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  backButton: {
    marginRight: theme.spacing(1),
  },
  titleContainer: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontWeight: 600,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: theme.spacing(2),
  },
  paper: {
    padding: theme.spacing(3),
  },
  jsonPre: {
    backgroundColor: theme.palette.background.default,
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius,
    overflow: 'auto',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
  },
}));

export const RCAReport: FC = () => {
  const classes = useStyles();
  const { alertId } = useParams<{ alertId: string }>();
  const { entity } = useEntity();
  const { filters } = useFilters();
  const organization =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.ORGANIZATION];

  // Get environments to ensure we have environment data
  const { environments } = useGetEnvironmentsByOrganization(organization);
  const environment = filters.environment || environments[0];

  const {
    report: detailedReport,
    loading,
    error,
  } = useRCAReportByAlert(alertId, environment?.uid, environment?.name, entity);

  return (
    <Box className={classes.container}>
      <Box className={classes.header}>
        <Box className={classes.headerLeft}>
          <IconButton
            component={Link}
            to=".."
            size="small"
            className={classes.backButton}
            title="Back to reports"
          >
            <ArrowBackIcon />
          </IconButton>
          <Box className={classes.titleContainer}>
            <Typography variant="h5" className={classes.title}>
              RCA Report
            </Typography>
          </Box>
        </Box>
      </Box>

      <Box className={classes.content}>
        {loading && <Progress />}

        {error && (
          <Alert severity="error">
            <Typography variant="body1">{error}</Typography>
          </Alert>
        )}

        {/* NOTE: Just render JSON until report format is finalized */}
        {!loading && !error && detailedReport && (
          <Paper className={classes.paper}>
            <Typography variant="h6" gutterBottom>
              Alert ID: {detailedReport.alertId || 'N/A'}
            </Typography>
            <pre className={classes.jsonPre}>
              {JSON.stringify(detailedReport, null, 2)}
            </pre>
          </Paper>
        )}
      </Box>
    </Box>
  );
};
