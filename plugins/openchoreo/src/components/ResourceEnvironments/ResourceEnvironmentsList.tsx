import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@material-ui/core';
import { useNavigate } from 'react-router-dom';
import { Progress, EmptyState } from '@backstage/core-components';
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
import { NoEnvironmentsEmptyState } from '../Environments/components/NoEnvironmentsEmptyState';
import { useEnvironmentPolling } from '../Environments/hooks';
import { ResourceDeployFlowCanvas } from './ResourceDeployFlowCanvas';
import { ResourceEnvironmentDetailPanel } from './ResourceEnvironmentDetailPanel';
import { ResourceReleaseManifestDialog } from './ResourceReleaseManifestDialog';
import {
  computeResourceReleaseDrift,
  type ResourceReleaseDriftInfo,
} from './computeResourceReleaseDrift';
import { ResourceSetupDetailPane } from './ResourceSetupDetailPane';
import {
  ResourceEnvironmentsProvider,
  type ActionKind,
} from './ResourceEnvironmentsContext';
import { ResourceRemoveDeploymentDialog } from './ResourceRemoveDeploymentDialog';
import { useResourceDeployFlowCanvasStyles } from './styles';

/**
 * Deploy view mounted at the `/` sub-route of the Resource entity's
 * `/environments` tab. Renders the pipeline DAG with the Set up tile +
 * env tiles on the left and the selected tile's detail panel on the
 * right. The `parameters-config` sub-route hosts the Step 1 wizard
 * reachable from the Set up detail pane's Configure & Deploy button.
 */
export const ResourceEnvironmentsList = () => {
  const canvasClasses = useResourceDeployFlowCanvasStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const notification = useNotification();
  const navigate = useNavigate();

  const [envs, setEnvs] = useState<ResourceEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    env: string;
    kind: ActionKind;
  } | null>(null);
  const [undeployTarget, setUndeployTarget] =
    useState<ResourceEnvironment | null>(null);
  const [manifestTarget, setManifestTarget] =
    useState<ResourceEnvironment | null>(null);
  const [selectedEnvName, setSelectedEnvNameState] = useState<string | null>(
    null,
  );
  const [selectedSetup, setSelectedSetup] = useState(false);
  const cancelledRef = useRef(false);

  // Selecting an env clears the Setup selection and vice versa — the
  // right pane shows at most one of them.
  const setSelectedEnvName = useCallback((name: string | null) => {
    setSelectedEnvNameState(name);
    if (name !== null) setSelectedSetup(false);
  }, []);

  const handleSelectSetup = useCallback(() => {
    setSelectedSetup(true);
    setSelectedEnvNameState(null);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedSetup(false);
    setSelectedEnvNameState(null);
  }, []);

  const handleConfigureDeploy = useCallback(() => {
    navigate('parameters-config');
  }, [navigate]);

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

  // Keep the current selection valid across refreshes. The detail
  // panel mirrors Component: it starts empty so the user picks a tile
  // explicitly, and clicking empty canvas space deselects. If the
  // previously selected env disappears between refreshes (e.g. the
  // project's deployment pipeline changed), clear the stale reference.
  useEffect(() => {
    if (!selectedEnvName) return;
    const stillPresent = envs.some(e => e.name === selectedEnvName);
    if (!stillPresent) {
      setSelectedEnvNameState(null);
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

  const handleUndeployRequest = useCallback(
    (envResourceName: string) => {
      const target =
        envs.find(e => (e.resourceName ?? e.name) === envResourceName) ?? null;
      setUndeployTarget(target);
    },
    [envs],
  );

  const handleUndeployConfirm = useCallback(async () => {
    if (!undeployTarget) return;
    const envResourceName = undeployTarget.resourceName ?? undeployTarget.name;
    const envLabel = undeployTarget.name;
    setPendingAction({ env: envResourceName, kind: 'undeploy' });
    try {
      await client.deleteResourceReleaseBinding(entity, envResourceName);
      if (cancelledRef.current) return;

      // Poll fetchResourceEnvironmentInfo to confirm the binding actually
      // disappears before reporting success. The Resource controller's
      // two-phase finalizer can defer cluster-side removal for several
      // seconds, so a green toast over the raw DELETE response would
      // race the UI ahead of reality.
      const POLL_INTERVAL_MS = 1500;
      const POLL_TIMEOUT_MS = 15_000;
      const deadline = Date.now() + POLL_TIMEOUT_MS;
      let confirmed = false;
      while (Date.now() < deadline && !cancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        if (cancelledRef.current) return;
        try {
          const refreshed = await client.fetchResourceEnvironmentInfo(entity);
          const match = (refreshed ?? []).find(
            e => (e.resourceName ?? e.name) === envResourceName,
          );
          if (!match || !match.bindingName) {
            confirmed = true;
            break;
          }
        } catch {
          // Transient fetch failure during reconcile — keep polling
          // until the deadline.
        }
      }

      if (cancelledRef.current) return;
      setUndeployTarget(null);
      await fetchEnvs();
      if (confirmed) {
        notification.showSuccess(`Undeployed ${envLabel}`);
      } else {
        notification.showSuccess(`Removal of ${envLabel} accepted`);
      }
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      notification.showError(
        `Failed to undeploy ${envLabel}: ${getErrorMessage(err)}`,
      );
    } finally {
      if (!cancelledRef.current) setPendingAction(null);
    }
  }, [client, entity, notification, fetchEnvs, undeployTarget]);

  const handleUndeployCancel = useCallback(() => {
    setUndeployTarget(null);
  }, []);

  const handleViewReleaseManifest = useCallback((env: ResourceEnvironment) => {
    setManifestTarget(env);
  }, []);

  const handleCloseReleaseManifest = useCallback(() => {
    setManifestTarget(null);
  }, []);

  const handleRetainPolicyChange = useCallback(
    async (envResourceName: string, next: 'Delete' | 'Retain') => {
      const env = envs.find(
        e => (e.resourceName ?? e.name) === envResourceName,
      );
      if (!env || !env.resourceRelease) return;
      const envLabel = env.name;
      setPendingAction({ env: envResourceName, kind: 'retain' });
      try {
        await client.updateResourceReleaseBinding(entity, envResourceName, {
          resourceRelease: env.resourceRelease,
          retainPolicy: next,
        });
        if (cancelledRef.current) return;
        notification.showSuccess(`Set retain policy on ${envLabel} to ${next}`);
        await fetchEnvs();
      } catch (err: unknown) {
        if (cancelledRef.current) return;
        notification.showError(
          `Failed to update retain policy on ${envLabel}: ${getErrorMessage(
            err,
          )}`,
        );
      } finally {
        if (!cancelledRef.current) setPendingAction(null);
      }
    },
    [client, entity, notification, fetchEnvs, envs],
  );

  const selectedEnv = envs.find(e => e.name === selectedEnvName) ?? null;

  const driftByEnv = useMemo(() => {
    const map = new Map<string, ResourceReleaseDriftInfo>();
    for (const env of envs) {
      map.set(env.name, computeResourceReleaseDrift(env, envs));
    }
    return map;
  }, [envs]);

  const contextValue = useMemo(
    () => ({
      environments: envs,
      loading,
      refetch: fetchEnvs,
      selectedEnvName,
      setSelectedEnvName,
      pendingAction,
      driftByEnv,
      onPromote: handlePromote,
      onUndeployRequest: handleUndeployRequest,
      onRetainPolicyChange: handleRetainPolicyChange,
      onViewReleaseManifest: handleViewReleaseManifest,
    }),
    [
      envs,
      loading,
      fetchEnvs,
      selectedEnvName,
      setSelectedEnvName,
      pendingAction,
      driftByEnv,
      handlePromote,
      handleUndeployRequest,
      handleRetainPolicyChange,
      handleViewReleaseManifest,
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
    return <Progress />;
  }

  if (error) {
    return (
      <EmptyState
        missing="data"
        title="Failed to load environments"
        description={getErrorMessage(error)}
      />
    );
  }

  if (envs.length === 0) {
    return <NoEnvironmentsEmptyState />;
  }

  return (
    <ResourceEnvironmentsProvider value={contextValue}>
      <NotificationBanner notification={notification.notification} />
      <Box className={canvasClasses.splitContainer}>
        <ResourceDeployFlowCanvas
          environments={envs}
          selectedEnvName={selectedEnvName}
          selectedSetup={selectedSetup}
          onSelectEnv={setSelectedEnvName}
          onSelectSetup={handleSelectSetup}
          onClearSelection={handleClearSelection}
        />
        <Box className={canvasClasses.detailPanelFrame}>
          {selectedSetup ? (
            <ResourceSetupDetailPane
              onConfigureDeploy={handleConfigureDeploy}
              onClose={handleClearSelection}
            />
          ) : (
            <ResourceEnvironmentDetailPanel
              env={selectedEnv}
              onClose={() => setSelectedEnvName(null)}
            />
          )}
        </Box>
      </Box>
      <ResourceRemoveDeploymentDialog
        open={undeployTarget !== null}
        environmentName={undeployTarget?.name ?? ''}
        isRemoving={
          pendingAction?.env ===
            (undeployTarget?.resourceName ?? undeployTarget?.name) &&
          pendingAction?.kind === 'undeploy'
        }
        onCancel={handleUndeployCancel}
        onConfirm={handleUndeployConfirm}
      />
      <ResourceReleaseManifestDialog
        open={manifestTarget !== null}
        onClose={handleCloseReleaseManifest}
        releaseName={manifestTarget?.resourceRelease}
        environmentName={manifestTarget?.name ?? ''}
      />
    </ResourceEnvironmentsProvider>
  );
};
