import { useEffect, useState, useCallback } from 'react';
import { Box, Button, Typography, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { DetailPageLayout } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { ReleaseInfoTabbedView } from './ReleaseDataRenderer/ReleaseInfoTabbedView';
import type { Environment } from './hooks/useEnvironmentData';

const useStyles = makeStyles(theme => ({
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    minHeight: '300px',
  },
  errorContainer: {
    padding: theme.spacing(3),
    backgroundColor: theme.palette.error.light,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.error.dark,
  },
  errorTitle: {
    fontWeight: 600,
    marginBottom: theme.spacing(1),
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    minHeight: '300px',
  },
}));

interface ReleaseDetailsPageProps {
  environment: Environment;
  entity: Entity;
  onBack: () => void;
  /** Initial tab to display (from URL) */
  initialTab?: string;
  /** Callback when tab changes (to update URL) */
  onTabChange?: (tabId: string) => void;
}

export const ReleaseDetailsPage = ({
  environment,
  entity,
  onBack,
  initialTab,
  onTabChange,
}: ReleaseDetailsPageProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [releaseData, setReleaseData] = useState<any>(null);

  const environmentName = environment.resourceName || environment.name;

  const loadReleaseData = useCallback(async () => {
    if (!environmentName) return;

    setLoading(true);
    setError(null);

    try {
      const data = await client.fetchEnvironmentRelease(
        entity,
        environmentName,
      );
      setReleaseData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load release details');
    } finally {
      setLoading(false);
    }
  }, [environmentName, entity, client]);

  useEffect(() => {
    loadReleaseData();
  }, [loadReleaseData]);

  const handleRetry = () => {
    loadReleaseData();
  };

  const actions = error ? (
    <Button onClick={handleRetry} color="primary" variant="outlined">
      Retry
    </Button>
  ) : null;

  return (
    <DetailPageLayout
      title="Release Details"
      subtitle={environment.name}
      onBack={onBack}
      actions={actions}
    >
      {loading && (
        <Box className={classes.loadingContainer}>
          <CircularProgress />
          <Typography variant="body2" color="textSecondary">
            Loading release details...
          </Typography>
        </Box>
      )}

      {error && !loading && (
        <Box className={classes.errorContainer}>
          <Typography className={classes.errorTitle}>
            Error Loading Release
          </Typography>
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}

      {!loading && !error && releaseData && (
        <ReleaseInfoTabbedView
          releaseData={releaseData}
          initialTab={initialTab}
          onTabChange={onTabChange}
        />
      )}

      {!loading && !error && !releaseData && (
        <Box className={classes.emptyContainer}>
          <Typography variant="body2" color="textSecondary">
            No release data available for this environment
          </Typography>
        </Box>
      )}
    </DetailPageLayout>
  );
};
