import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { ApiProvider } from '@backstage/core-app-api';
import { useApi, type ApiHolder } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { DetailPageLayout } from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  type OpenChoreoClientApi,
} from '../../api/OpenChoreoClientApi';
import { getErrorMessage, isForbiddenError } from '../../utils/errorUtils';
import { useEnvironmentPolling } from '../Environments/hooks';
import { envResourceName } from './endpointEnvironmentUtils';
import { ResourceTreeView } from '../Environments/ReleaseDataRenderer/ResourceTreeView';

/** The same states as a component's Release Details page. */
const useStyles = makeStyles(theme => ({
  centered: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    minHeight: 300,
  },
  error: {
    padding: theme.spacing(3),
    backgroundColor: theme.palette.error.light,
    borderRadius: theme.shape.borderRadius,
    color: theme.palette.error.dark,
  },
  errorTitle: { fontWeight: 600, marginBottom: theme.spacing(1) },
}));

/**
 * The live Kubernetes resources an Endpoint runs in one environment (its
 * routes, policies and whatever else its EndpointType renders) as the
 * resource tree a component's View K8s Artifacts shows. Mounted at
 * `/environments/artifacts/:envName`.
 */
export const EndpointArtifactsPage = () => {
  const classes = useStyles();
  const navigate = useNavigate();
  const { envName = '' } = useParams<{ envName: string }>();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [binding, setBinding] = useState<Record<string, unknown> | null>(null);
  const [tree, setTree] = useState<any>(null);
  const [envLabel, setEnvLabel] = useState(envName);

  const latest = useRef(0);
  // Set until a load lands; a refresh that lands first then answers for it.
  const firstPending = useRef(true);
  const load = useCallback(
    async (initial: boolean) => {
      const read = ++latest.current;
      if (initial) {
        firstPending.current = true;
        setLoading(true);
        setError(null);
      }
      try {
        const envs = await client.fetchEndpointEnvironmentInfo(entity);
        const env = (envs ?? []).find(e => envResourceName(e) === envName);
        // The view reads the binding's name and status, as the environment
        // info carries them.
        const match = env?.bindingName
          ? {
              name: env.bindingName,
              status: env.status,
              statusReason: env.statusReason,
              statusMessage: env.statusMessage,
            }
          : null;
        const nextTree = match
          ? await client.fetchEndpointResourceTree(namespaceName, match.name)
          : { renderedReleases: [] };
        if (read !== latest.current) return;
        setBinding(match);
        setTree(nextTree);
        setError(null);
      } catch (err) {
        if (read !== latest.current) return;
        if (!initial && !firstPending.current) throw err;
        setError(
          isForbiddenError(err)
            ? 'You do not have permission to view this environment’s resources. Contact your administrator.'
            : getErrorMessage(err),
        );
      } finally {
        if (read === latest.current) {
          firstPending.current = false;
          setLoading(false);
        }
      }
    },
    [client, entity, envName, namespaceName],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  useEffect(() => {
    client
      .fetchEndpointEnvironmentInfo(entity)
      .then(envs => {
        const env = envs.find(e => e.resourceName === envName);
        if (env?.name) setEnvLabel(env.name);
      })
      .catch(() => {});
  }, [client, entity, envName]);

  useEnvironmentPolling(
    Boolean(envName),
    useCallback(() => {
      void load(false).catch(() => {});
    }, [load]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // The tree's resource panels read events through the client; point them
  // at this Endpoint's binding instead of a component's.
  const bindingName = (binding?.name as string | undefined) ?? '';
  const apis = useMemo(() => {
    const scoped: OpenChoreoClientApi = Object.create(client);
    scoped.fetchResourceEvents = (ns, _name, params) =>
      client.fetchEndpointResourceEvents(ns, bindingName, params);
    // Every other API comes from the app, as ApiProvider falls back to it.
    const holder: ApiHolder = {
      get: ref =>
        ref.id === openChoreoClientApiRef.id ? (scoped as any) : undefined,
    };
    return holder;
  }, [client, bindingName]);

  return (
    <DetailPageLayout
      title="Release Details"
      subtitle={envLabel}
      onBack={() => navigate('../..', { relative: 'path' })}
      actions={
        error ? (
          <Button
            onClick={() => void load(true)}
            color="primary"
            variant="outlined"
          >
            Retry
          </Button>
        ) : undefined
      }
    >
      {loading && (
        <Box className={classes.centered}>
          <CircularProgress />
          <Typography variant="body2" color="textSecondary">
            Loading release details...
          </Typography>
        </Box>
      )}

      {error && !loading && (
        <Box className={classes.error}>
          <Typography className={classes.errorTitle}>
            Error Loading Release
          </Typography>
          <Typography variant="body2">{error}</Typography>
        </Box>
      )}

      {!loading && !error && binding && (
        <ApiProvider apis={apis}>
          <ResourceTreeView
            resourceTreeData={tree ?? { renderedReleases: [] }}
            releaseBindingData={binding}
            namespaceName={namespaceName}
            releaseBindingName={bindingName}
            onRefresh={refresh}
            isRefreshing={refreshing}
          />
        </ApiProvider>
      )}

      {!loading && !error && !binding && (
        <Box className={classes.centered}>
          <Typography variant="body2" color="textSecondary">
            No release data available for this environment
          </Typography>
        </Box>
      )}
    </DetailPageLayout>
  );
};
