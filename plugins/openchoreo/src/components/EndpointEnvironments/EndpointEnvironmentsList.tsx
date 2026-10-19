import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '@backstage/core-components';
import { PageLoader } from '@openchoreo/backstage-design-system';
import { Box } from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { ForbiddenState } from '@openchoreo/backstage-plugin-react';
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
  type EndpointReleaseDriftInfo,
} from './endpointEnvironmentUtils';

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
      try {
        const res = await client.fetchEndpointEnvironmentInfo(entity);
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

  // Drop a selection whose environment disappeared between refreshes.
  useEffect(() => {
    if (selectedEnvName && !envs.some(e => e.name === selectedEnvName)) {
      setSelectedEnvNameState(null);
    }
  }, [envs, selectedEnvName]);

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
