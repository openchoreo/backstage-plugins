import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@backstage/core-components';
import { PageLoader } from '@openchoreo/backstage-design-system';
import { Box } from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { useAsyncEntity, useEntity } from '@backstage/plugin-catalog-react';
import {
  ForbiddenState,
  MINI_ENV_NODE_HEIGHT,
} from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  type EndpointEnvironment,
} from '../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';
import { useNotification } from '../../hooks';
import { NotificationBanner } from '../Environments/components';
import { NoEnvironmentsEmptyState } from '../Environments/components/NoEnvironmentsEmptyState';
import { useEnvironmentPolling } from '../Environments/hooks';
import { PipelineDeployCanvas } from '../PipelineDeployCanvas';
import {
  ReleaseManifestDialog,
  type LoadRelease,
} from '../ResourceEnvironments/ResourceReleaseManifestDialog';
import { useResourceDeployFlowCanvasStyles } from '../ResourceEnvironments/styles';
import {
  EndpointEnvironmentsProvider,
  type EndpointActionKind,
} from './EndpointEnvironmentsContext';
import { EndpointEnvironmentDetailPanel } from './EndpointEnvironmentDetailPanel';
import { EndpointMiniEnvironmentNode } from './EndpointMiniEnvironmentNode';
import { EndpointRemoveDeploymentDialog } from './EndpointRemoveDeploymentDialog';
import { EndpointSetupCard, EndpointSetupDetailPane } from './EndpointSetup';
import {
  computeEndpointReleaseDrift,
  envResourceName,
  resolveDefaultEndpointSelection,
  type EndpointReleaseDriftInfo,
} from './endpointEnvironmentUtils';
import { useAwaitEndpointRelease } from './useAwaitEndpointRelease';
import type { EndpointBackend } from '../EndpointOverview/EndpointBackendList';

// An Endpoint tile has a Backends row the default tile height has no room
// for, which pushed the Promote button onto the tile's border.
const ENDPOINT_ENV_NODE_HEIGHT = MINI_ENV_NODE_HEIGHT + 28;

const loadEndpointRelease: LoadRelease = (client, entity, releaseName) =>
  client.fetchEndpointRelease(entity, releaseName);

/**
 * Deploy view of the Endpoint entity's `/environments` tab: the pipeline
 * canvas with a Set up tile and one tile per environment on the left, and the
 * selected tile's detail panel on the right.
 */
export const EndpointEnvironmentsList = () => {
  const canvasClasses = useResourceDeployFlowCanvasStyles();
  const { entity } = useEntity();
  const { refresh } = useAsyncEntity();
  const client = useApi(openChoreoClientApiRef);
  const notification = useNotification();

  const [envs, setEnvs] = useState<EndpointEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    env: string;
    kind: EndpointActionKind;
  } | null>(null);
  const [undeployTarget, setUndeployTarget] =
    useState<EndpointEnvironment | null>(null);
  const [manifestTarget, setManifestTarget] =
    useState<EndpointEnvironment | null>(null);
  const [selectedEnvName, setSelectedEnvNameState] = useState<string | null>(
    null,
  );
  const [selectedSetup, setSelectedSetup] = useState(false);
  const cancelledRef = useRef(false);
  const fetchSeqRef = useRef(0);

  // The right pane shows at most one of the Set up pane and an environment.
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

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const fetchEnvs = useCallback(
    async (opts: { showProgress?: boolean } = {}) => {
      if (opts.showProgress) setLoading(true);
      // Polls can overlap; only the newest request's response applies.
      const seq = ++fetchSeqRef.current;
      const stale = () => cancelledRef.current || seq !== fetchSeqRef.current;
      try {
        const res = await client.fetchEndpointEnvironmentInfo(entity);
        if (stale()) return;
        setEnvs(res ?? []);
        setError(null);
      } catch (err: unknown) {
        if (stale()) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (!cancelledRef.current && opts.showProgress) setLoading(false);
      }
    },
    [client, entity],
  );

  // Only the first load shows the page loader. A refreshed entity (after a
  // backend change, say) refetches quietly, so the open pane stays mounted.
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    fetchEnvs({ showProgress: !loadedOnceRef.current });
    loadedOnceRef.current = true;
  }, [fetchEnvs]);

  // One-shot guard so the default selection below doesn't override the
  // user closing the right pane, which clears the selection.
  const didAutoSelectRef = useRef(false);

  // Drop a selection whose environment disappeared between refreshes.
  useEffect(() => {
    if (selectedEnvName && !envs.some(e => e.name === selectedEnvName)) {
      setSelectedEnvNameState(null);
      // Let a fresh default be picked.
      didAutoSelectRef.current = false;
    }
  }, [envs, selectedEnvName]);

  // Select a card once the environments have loaded, as the Component Deploy
  // tab does, so the right pane doesn't open empty: the lowest environment
  // the Endpoint is deployed to, else Set up.
  useEffect(() => {
    if (didAutoSelectRef.current) return;
    if (loading || selectedSetup || selectedEnvName !== null) return;
    if (envs.length === 0) return;

    didAutoSelectRef.current = true;
    const selection = resolveDefaultEndpointSelection(envs);
    if (selection?.kind === 'env') setSelectedEnvName(selection.name);
    else if (selection?.kind === 'setup') handleSelectSetup();
  }, [
    envs,
    loading,
    selectedEnvName,
    selectedSetup,
    setSelectedEnvName,
    handleSelectSetup,
  ]);

  // A backend change made on the Set up pane is awaited here, not in the
  // pane, so the wait survives the pane closing or another tile's selection.
  const backends =
    (entity.spec as { backends?: EndpointBackend[] } | undefined)?.backends ??
    [];
  const releaseAwait = useAwaitEndpointRelease({
    // The view orders environments by the pipeline; the first carries the
    // latest release.
    latestRelease: envs[0]?.latestRelease,
    backends,
    refetchEnvironments: fetchEnvs,
    refreshEntity: () => refresh?.(),
  });

  // Poll while any binding is rolling out, until its routes are accepted.
  useEnvironmentPolling(
    envs.some(e => e.status === 'NotReady'),
    fetchEnvs,
  );

  const handlePromote = useCallback(
    async (environment: string, releaseName: string) => {
      setPendingAction({ env: environment, kind: 'promote' });
      try {
        await client.updateEndpointReleaseBinding(entity, environment, {
          endpointRelease: releaseName,
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
      setUndeployTarget(
        envs.find(e => envResourceName(e) === environment) ?? null,
      );
    },
    [envs],
  );

  const handleUndeployConfirm = useCallback(async () => {
    if (!undeployTarget) return;
    const environment = envResourceName(undeployTarget);
    const envLabel = undeployTarget.name;
    setPendingAction({ env: environment, kind: 'undeploy' });
    try {
      await client.deleteEndpointReleaseBinding(entity, environment);
      if (cancelledRef.current) return;

      // The binding's finalizer removes the routes before the binding goes
      // away, so wait for it to disappear before reporting success.
      const POLL_INTERVAL_MS = 1500;
      const deadline = Date.now() + 15_000;
      let confirmed = false;
      while (Date.now() < deadline && !cancelledRef.current) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
        if (cancelledRef.current) return;
        try {
          const refreshed = await client.fetchEndpointEnvironmentInfo(entity);
          const match = (refreshed ?? []).find(
            e => envResourceName(e) === environment,
          );
          if (!match?.bindingName) {
            confirmed = true;
            break;
          }
        } catch {
          // Transient failure while the finalizer runs; keep polling.
        }
      }

      if (cancelledRef.current) return;
      setUndeployTarget(null);
      await fetchEnvs();
      notification.showSuccess(
        confirmed
          ? `Undeployed ${envLabel}`
          : `Removal of ${envLabel} accepted`,
      );
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      notification.showError(
        `Failed to undeploy ${envLabel}: ${getErrorMessage(err)}`,
      );
    } finally {
      if (!cancelledRef.current) setPendingAction(null);
    }
  }, [client, entity, notification, fetchEnvs, undeployTarget]);

  const driftByEnv = useMemo(() => {
    const map = new Map<string, EndpointReleaseDriftInfo>();
    for (const env of envs) {
      map.set(env.name, computeEndpointReleaseDrift(env, envs));
    }
    return map;
  }, [envs]);

  const contextValue = useMemo(
    () => ({
      environments: envs,
      refetch: fetchEnvs,
      pendingAction,
      driftByEnv,
      onPromote: handlePromote,
      onUndeployRequest: handleUndeployRequest,
      onViewReleaseManifest: setManifestTarget,
    }),
    [
      envs,
      fetchEnvs,
      pendingAction,
      driftByEnv,
      handlePromote,
      handleUndeployRequest,
    ],
  );

  if (isForbiddenError(error)) {
    return (
      <ForbiddenState
        message="You do not have permission to view environments for this endpoint."
        minHeight="400px"
      />
    );
  }
  if (loading) {
    return <PageLoader />;
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

  const selectedEnv = envs.find(e => e.name === selectedEnvName) ?? null;

  return (
    <EndpointEnvironmentsProvider value={contextValue}>
      <NotificationBanner notification={notification.notification} />
      <Box className={canvasClasses.splitContainer}>
        <PipelineDeployCanvas
          environments={envs}
          selectedEnvName={selectedEnvName}
          selectedSetup={selectedSetup}
          onSelectEnv={setSelectedEnvName}
          onSelectSetup={handleSelectSetup}
          onClearSelection={handleClearSelection}
          testId="endpoint-deploy-flow-canvas"
          environmentNodeHeight={ENDPOINT_ENV_NODE_HEIGHT}
          renderSetup={selected => <EndpointSetupCard selected={selected} />}
          renderEnvironment={(env, selected, onSelect) => (
            <EndpointMiniEnvironmentNode
              env={env}
              selected={selected}
              onSelect={onSelect}
            />
          )}
        />
        <Box className={canvasClasses.detailPanelFrame}>
          {selectedSetup ? (
            // The view orders environments by the pipeline, so the first is
            // where a new release enters.
            <EndpointSetupDetailPane
              firstEnvironment={envs[0]}
              releaseAwait={releaseAwait}
              onClose={handleClearSelection}
            />
          ) : (
            <EndpointEnvironmentDetailPanel
              env={selectedEnv}
              onClose={() => setSelectedEnvName(null)}
            />
          )}
        </Box>
      </Box>
      <EndpointRemoveDeploymentDialog
        open={undeployTarget !== null}
        environmentName={undeployTarget?.name ?? ''}
        isRemoving={
          pendingAction?.kind === 'undeploy' &&
          undeployTarget !== null &&
          pendingAction.env === envResourceName(undeployTarget)
        }
        onCancel={() => setUndeployTarget(null)}
        onConfirm={handleUndeployConfirm}
      />
      <ReleaseManifestDialog
        open={manifestTarget !== null}
        onClose={() => setManifestTarget(null)}
        releaseName={manifestTarget?.endpointRelease}
        environmentName={manifestTarget?.name ?? ''}
        loadRelease={loadEndpointRelease}
      />
    </EndpointEnvironmentsProvider>
  );
};
