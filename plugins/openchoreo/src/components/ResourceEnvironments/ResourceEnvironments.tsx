import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, makeStyles } from '@material-ui/core';
import { Progress } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { ForbiddenState } from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  type ResourceEnvironment,
} from '../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';
import { useNotification } from '../../hooks';
import { NotificationBanner } from '../Environments/components';
import { useEnvironmentPolling } from '../Environments/hooks';
import { ResourceDeployFlowCanvas } from './ResourceDeployFlowCanvas';
import { ResourceEnvironmentDetailPanel } from './ResourceEnvironmentDetailPanel';
import {
  ResourceEnvironmentsProvider,
  type ActionKind,
} from './ResourceEnvironmentsContext';
import { UndeployConfirmDialog } from './UndeployConfirmDialog';
import { useResourceDeployFlowCanvasStyles } from './styles';

const useStyles = makeStyles(theme => ({
  page: {
    padding: theme.spacing(3),
  },
  error: {
    color: theme.palette.error.main,
  },
  empty: {
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
  },
}));

export const ResourceEnvironments = () => {
  const classes = useStyles();
  const canvasClasses = useResourceDeployFlowCanvasStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const notification = useNotification();

  const [envs, setEnvs] = useState<ResourceEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    env: string;
    kind: ActionKind;
  } | null>(null);
  const [undeployTarget, setUndeployTarget] =
    useState<ResourceEnvironment | null>(null);
  const [selectedEnvName, setSelectedEnvName] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const fetchEnvs = useCallback(
    async (opts: { showProgress?: boolean } = {}) => {
      if (opts.showProgress) setLoading(true);
      try {
        const res = await client.fetchResourceEnvironmentInfo(entity);
        if (cancelledRef.current) return;
        setEnvs(res ?? []);
        setError(null);
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelledRef.current && opts.showProgress) setLoading(false);
      }
    },
    [client, entity],
  );

  useEffect(() => {
    fetchEnvs({ showProgress: true });
  }, [fetchEnvs]);

  // Auto-select the first env once data lands so the detail panel isn't
  // empty on initial render. Subsequent loads don't override the user's
  // selection unless the previously selected env disappeared.
  useEffect(() => {
    if (envs.length === 0) return;
    if (!selectedEnvName) {
      setSelectedEnvName(envs[0].name);
      return;
    }
    const stillPresent = envs.some(e => e.name === selectedEnvName);
    if (!stillPresent) {
      setSelectedEnvName(envs[0].name);
    }
  }, [envs, selectedEnvName]);

  // Background poll while any binding is mid-rollout. Pin advances kick
  // the controller into a Progressing state that flips back to Ready
  // once the underlying RenderedRelease is reconciled.
  const isAnyPending = envs.some(e => e.status === 'NotReady');
  useEnvironmentPolling(isAnyPending, fetchEnvs);

  const handlePromote = useCallback(
    async (environment: string, releaseName: string) => {
      setPendingAction({ env: environment, kind: 'promote' });
      try {
        await client.updateResourceReleaseBinding(entity, environment, {
          resourceRelease: releaseName,
        });
        if (cancelledRef.current) return;
        notification.showSuccess(`Promoted ${environment} to ${releaseName}`);
        await fetchEnvs();
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        notification.showError(
          `Failed to promote ${environment}: ${getErrorMessage(err)}`,
        );
      } finally {
        if (!cancelledRef.current) setPendingAction(null);
      }
    },
    [client, entity, notification, fetchEnvs],
  );

  const handleDeploy = useCallback(
    async (environment: string, releaseName: string) => {
      setPendingAction({ env: environment, kind: 'deploy' });
      try {
        await client.updateResourceReleaseBinding(entity, environment, {
          resourceRelease: releaseName,
        });
        if (cancelledRef.current) return;
        notification.showSuccess(`Deployed ${releaseName} to ${environment}`);
        await fetchEnvs();
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        notification.showError(
          `Failed to deploy to ${environment}: ${getErrorMessage(err)}`,
        );
      } finally {
        if (!cancelledRef.current) setPendingAction(null);
      }
    },
    [client, entity, notification, fetchEnvs],
  );

  const handleUndeployRequest = useCallback(
    (environment: string) => {
      const target = envs.find(e => e.name === environment) ?? null;
      setUndeployTarget(target);
    },
    [envs],
  );

  const handleUndeployConfirm = useCallback(async () => {
    if (!undeployTarget) return;
    const environment = undeployTarget.name;
    setPendingAction({ env: environment, kind: 'undeploy' });
    try {
      await client.deleteResourceReleaseBinding(entity, environment);
      if (cancelledRef.current) return;
      notification.showSuccess(`Undeployed ${environment}`);
      setUndeployTarget(null);
      await fetchEnvs();
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      notification.showError(
        `Failed to undeploy ${environment}: ${getErrorMessage(err)}`,
      );
    } finally {
      if (!cancelledRef.current) setPendingAction(null);
    }
  }, [client, entity, notification, fetchEnvs, undeployTarget]);

  const handleUndeployCancel = useCallback(() => {
    setUndeployTarget(null);
  }, []);

  const handleRetainPolicyChange = useCallback(
    async (environment: string, next: 'Delete' | 'Retain') => {
      const env = envs.find(e => e.name === environment);
      if (!env || !env.resourceRelease) return;
      setPendingAction({ env: environment, kind: 'retain' });
      try {
        await client.updateResourceReleaseBinding(entity, environment, {
          resourceRelease: env.resourceRelease,
          retainPolicy: next,
        });
        if (cancelledRef.current) return;
        notification.showSuccess(
          `Set retain policy on ${environment} to ${next}`,
        );
        await fetchEnvs();
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        notification.showError(
          `Failed to update retain policy on ${environment}: ${getErrorMessage(err)}`,
        );
      } finally {
        if (!cancelledRef.current) setPendingAction(null);
      }
    },
    [client, entity, notification, fetchEnvs, envs],
  );

  const selectedEnv =
    envs.find(e => e.name === selectedEnvName) ?? null;

  const contextValue = useMemo(
    () => ({
      environments: envs,
      loading,
      refetch: fetchEnvs,
      selectedEnvName,
      setSelectedEnvName,
      pendingAction,
      onPromote: handlePromote,
      onDeploy: handleDeploy,
      onUndeployRequest: handleUndeployRequest,
      onRetainPolicyChange: handleRetainPolicyChange,
    }),
    [
      envs,
      loading,
      fetchEnvs,
      selectedEnvName,
      pendingAction,
      handlePromote,
      handleDeploy,
      handleUndeployRequest,
      handleRetainPolicyChange,
    ],
  );

  if (isForbiddenError(error)) {
    return (
      <ForbiddenState
        message="You do not have permission to view environments for this resource."
        minHeight="400px"
      />
    );
  }

  if (loading) {
    return (
      <Box className={classes.page}>
        <Progress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={classes.page}>
        <Typography variant="body1" className={classes.error}>
          Failed to load environments: {getErrorMessage(error)}
        </Typography>
      </Box>
    );
  }

  if (envs.length === 0) {
    return (
      <Box className={classes.page}>
        <Typography variant="body1" className={classes.empty}>
          No environments configured in the project's deployment pipeline.
        </Typography>
      </Box>
    );
  }

  return (
    <ResourceEnvironmentsProvider value={contextValue}>
      <Box className={classes.page}>
        <NotificationBanner notification={notification.notification} />
        <Box className={canvasClasses.splitContainer}>
          <ResourceDeployFlowCanvas
            environments={envs}
            selectedEnvName={selectedEnvName}
            onSelectEnv={setSelectedEnvName}
          />
          <Box className={canvasClasses.detailPanelFrame}>
            <ResourceEnvironmentDetailPanel
              env={selectedEnv}
              onClose={() => setSelectedEnvName(null)}
            />
          </Box>
        </Box>
        <UndeployConfirmDialog
          open={undeployTarget !== null}
          envName={undeployTarget?.name ?? ''}
          retainPolicy={undeployTarget?.retainPolicy}
          busy={
            pendingAction?.env === undeployTarget?.name &&
            pendingAction?.kind === 'undeploy'
          }
          onCancel={handleUndeployCancel}
          onConfirm={handleUndeployConfirm}
        />
      </Box>
    </ResourceEnvironmentsProvider>
  );
};
