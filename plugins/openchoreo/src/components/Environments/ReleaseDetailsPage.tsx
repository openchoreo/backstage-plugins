import { useEffect, useState, useCallback } from 'react';
import { Box, Button, Typography, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { DetailPageLayout } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { useEnvironmentPolling } from './hooks';
import { ResourceTreeView } from './ReleaseDataRenderer/ResourceTreeView';
import type { Environment } from './hooks';

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
}

export const ReleaseDetailsPage = ({
  environment,
  entity,
  onBack,
}: ReleaseDetailsPageProps) => {
  const classes = useStyles();
  const client = useApi(openChoreoClientApiRef);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [releaseData, setReleaseData] = useState<any>(null);
  const [resourceTreeData, setResourceTreeData] = useState<any>(null);
  const [releaseBindingData, setReleaseBindingData] = useState<Record<
    string,
    unknown
  > | null>(null);

  const environmentName = environment.resourceName || environment.name;

  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';

  const loadReleaseData = useCallback(
    async (showLoadingState = true) => {
      if (!environmentName) return;

      if (showLoadingState) {
        setLoading(true);
        setError(null);
      }

      try {
        // Fetch release data and release bindings in parallel
        const [releaseResult, releaseBindingsResult] = await Promise.all([
          client.fetchEnvironmentRelease(entity, environmentName),
          client.fetchReleaseBindings(entity).catch(err => {
            if (showLoadingState) {
              return {
                success: false,
                data: { items: [] },
              };
            }
            throw err;
          }),
        ]);

        // Find the release binding matching this environment
        const bindingsResult = releaseBindingsResult as any;
        const bindings: any[] = bindingsResult?.data?.items ?? [];
        const matchingBinding =
          bindings.find((b: any) => b.environment === environmentName) ?? null;

        // Fetch resource tree using the matched binding name
        const bindingName = matchingBinding?.name;
        let nextResourceTreeData: any = { releases: [] };

        if (bindingName && namespaceName) {
          nextResourceTreeData = await client
            .fetchResourceTree(namespaceName, bindingName as string)
            .catch(err => {
              if (showLoadingState) {
                return { releases: [] };
              }
              throw err;
            });
        }

        setReleaseData(releaseResult);
        setReleaseBindingData(matchingBinding);
        setResourceTreeData(nextResourceTreeData);
      } catch (err: any) {
        if (showLoadingState) {
          setError(err.message || 'Failed to load release details');
        }
      } finally {
        if (showLoadingState) {
          setLoading(false);
        }
      }
    },
    [environmentName, namespaceName, entity, client],
  );

  useEffect(() => {
    loadReleaseData();
  }, [loadReleaseData]);

  const shouldPollReleaseDetails = Boolean(environmentName);
  const pollReleaseData = useCallback(() => {
    void loadReleaseData(false);
  }, [loadReleaseData]);
  useEnvironmentPolling(shouldPollReleaseDetails, pollReleaseData);

  const handleRetry = () => {
    loadReleaseData();
  };

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadReleaseData(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadReleaseData]);

  const actions = error ? (
    <Button onClick={handleRetry} color="primary" variant="outlined">
      Retry
    </Button>
  ) : undefined;

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

      {!loading && !error && (releaseData || releaseBindingData) && (
        <ResourceTreeView
          releaseData={releaseData}
          resourceTreeData={resourceTreeData ?? { releases: [] }}
          releaseBindingData={releaseBindingData}
          namespaceName={namespaceName}
          releaseBindingName={(releaseBindingData as any)?.name ?? ''}
          onRefresh={handleManualRefresh}
          isRefreshing={refreshing}
        />
      )}

      {!loading && !error && !releaseData && !releaseBindingData && (
        <Box className={classes.emptyContainer}>
          <Typography variant="body2" color="textSecondary">
            No release data available for this environment
          </Typography>
        </Box>
      )}
    </DetailPageLayout>
  );
};
