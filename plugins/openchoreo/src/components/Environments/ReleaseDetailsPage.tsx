import { useEffect, useState, useCallback } from 'react';
import { Box, Button, Typography, CircularProgress } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { DetailPageLayout } from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import { ResourceTreeView } from './ReleaseDataRenderer/ResourceTreeView';
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
  const [releaseData, setReleaseData] = useState<any>(null);
  const [resourceTreeData, setResourceTreeData] = useState<any>(null);
  const [releaseBindingData, setReleaseBindingData] = useState<Record<
    string,
    unknown
  > | null>(null);

  const environmentName = environment.resourceName || environment.name;

  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';

  const loadReleaseData = useCallback(async () => {
    if (!environmentName) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch release data and release bindings in parallel
      const [releaseResult, releaseBindingsResult] = await Promise.all([
        client.fetchEnvironmentRelease(entity, environmentName),
        client.fetchReleaseBindings(entity).catch(() => ({
          success: false,
          data: { items: [] },
        })),
      ]);
      setReleaseData(releaseResult);

      // Find the release binding matching this environment
      // Handle both legacy format ({ success, data: { items } }) and new API format ({ items })
      const bindingsResult = releaseBindingsResult as any;
      const bindings: any[] =
        bindingsResult?.data?.items ?? bindingsResult?.items ?? [];
      const matchingBinding =
        bindings.find(
          (b: any) =>
            (b.environment ?? b.spec?.environment) === environmentName,
        ) ?? null;
      setReleaseBindingData(matchingBinding);

      // Fetch resource tree using the matched binding name
      const bindingName =
        matchingBinding?.name ??
        (matchingBinding?.metadata as Record<string, unknown>)?.name;
      if (bindingName && namespaceName) {
        const resourceTreeResult = await client
          .fetchResourceTree(namespaceName, bindingName as string)
          .catch(() => ({ releases: [] }));
        setResourceTreeData(resourceTreeResult);
      } else {
        setResourceTreeData({ releases: [] });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load release details');
    } finally {
      setLoading(false);
    }
  }, [environmentName, namespaceName, entity, client]);

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

      {!loading && !error && releaseData && (
        <ResourceTreeView
          releaseData={releaseData}
          resourceTreeData={resourceTreeData}
          releaseBindingData={releaseBindingData}
          namespaceName={namespaceName}
          releaseBindingName={
            (releaseBindingData as any)?.name ??
            ((releaseBindingData as any)?.metadata as Record<string, unknown>)
              ?.name ??
            ''
          }
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
