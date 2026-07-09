import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box } from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Progress, EmptyState } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { ForbiddenState } from '@openchoreo/backstage-plugin-react';
import {
  openChoreoClientApiRef,
  type ProjectEnvironment,
} from '../../api/OpenChoreoClientApi';
import { isForbiddenError, getErrorMessage } from '../../utils/errorUtils';
import { useNotification } from '../../hooks';
import { NotificationBanner } from '../Environments/components';
import { NoEnvironmentsEmptyState } from '../Environments/components/NoEnvironmentsEmptyState';
import { useEnvironmentPolling } from '../Environments/hooks';
import { ProjectDeployFlowCanvas } from './ProjectDeployFlowCanvas';
import { ProjectEnvironmentDetailPanel } from './ProjectEnvironmentDetailPanel';
import { ProjectSetupDetailPane } from './ProjectSetupDetailPane';
import {
  ProjectEnvironmentsProvider,
  type ActionKind,
} from './ProjectEnvironmentsContext';
import { useProjectDeployFlowCanvasStyles } from './styles';

/**
 * Deploy view mounted at the `/` sub-route of the Project entity's
 * `/deploy` tab. Renders the pipeline DAG with the Set up tile + env
 * tiles on the left and the selected tile's detail panel on the right.
 * The `parameters-config` sub-route hosts the Step 1 wizard reachable
 * from the Set up detail pane's Configure & Deploy button.
 */
export const ProjectEnvironmentsList = () => {
  const canvasClasses = useProjectDeployFlowCanvasStyles();
  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);
  const notification = useNotification();
  const navigate = useNavigate();

  const [envs, setEnvs] = useState<ProjectEnvironment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    env: string;
    kind: ActionKind;
  } | null>(null);
  const [selectedEnvName, setSelectedEnvNameState] = useState<string | null>(
    null,
  );
  const [selectedSetup, setSelectedSetup] = useState(false);
  const cancelledRef = useRef(false);

  // Arrival from a component's "Deploy project" hand-off:
  // `?env=<resource>&intent=deploy` pre-selects that environment and shows a
  // one-time hint. Seeding runs once, after envs load.
  const [searchParams] = useSearchParams();
  const arrivalEnv = searchParams.get('env');
  const arrivalIntent = searchParams.get('intent');
  const [arrivalHintDismissed, setArrivalHintDismissed] = useState(false);
  const arrivalSeededRef = useRef(false);

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
        const res = await client.fetchProjectEnvironmentInfo(entity);
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

  // Keep the current selection valid across refreshes. The detail panel
  // starts empty so the user picks a tile explicitly, and clicking empty
  // canvas space deselects. If the previously selected env disappears
  // between refreshes (e.g. the project's deployment pipeline changed),
  // clear the stale reference.
  useEffect(() => {
    if (!selectedEnvName) return;
    const stillPresent = envs.some(e => e.name === selectedEnvName);
    if (!stillPresent) {
      setSelectedEnvNameState(null);
    }
  }, [envs, selectedEnvName]);

  // Pre-select the arrival environment once, after envs load. Match on the
  // resource name (what the deep link carries) with a display-name fallback.
  useEffect(() => {
    if (arrivalSeededRef.current || !arrivalEnv || envs.length === 0) return;
    const match = envs.find(
      e =>
        e.resourceName === arrivalEnv ||
        e.name.toLowerCase() === arrivalEnv.toLowerCase(),
    );
    if (match) {
      setSelectedEnvName(match.name);
      arrivalSeededRef.current = true;
    }
  }, [arrivalEnv, envs, setSelectedEnvName]);

  // Background poll while any binding is mid-rollout. Pin advances kick the
  // controller into a Progressing state that flips back to Ready once the
  // underlying RenderedRelease is reconciled.
  const isAnyPending = envs.some(e => e.status === 'NotReady');
  useEnvironmentPolling(isAnyPending, fetchEnvs);

  const handlePromote = useCallback(
    async (environment: string, releaseName: string) => {
      setPendingAction({ env: environment, kind: 'promote' });
      try {
        await client.updateProjectReleaseBinding(entity, environment, {
          projectRelease: releaseName,
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

  const selectedEnv = envs.find(e => e.name === selectedEnvName) ?? null;

  const contextValue = useMemo(
    () => ({
      environments: envs,
      loading,
      refetch: fetchEnvs,
      selectedEnvName,
      setSelectedEnvName,
      pendingAction,
      onPromote: handlePromote,
    }),
    [
      envs,
      loading,
      fetchEnvs,
      selectedEnvName,
      setSelectedEnvName,
      pendingAction,
      handlePromote,
    ],
  );

  if (isForbiddenError(error)) {
    return (
      <ForbiddenState
        message="You do not have permission to view environments for this project."
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
    <ProjectEnvironmentsProvider value={contextValue}>
      <NotificationBanner notification={notification.notification} />
      {arrivalIntent === 'deploy' && !arrivalHintDismissed && (
        <Alert
          severity="info"
          onClose={() => setArrivalHintDismissed(true)}
          style={{ marginBottom: 8 }}
        >
          Deploy the project here, then return to your component tab to
          continue.
        </Alert>
      )}
      <Box className={canvasClasses.splitContainer}>
        <ProjectDeployFlowCanvas
          environments={envs}
          selectedEnvName={selectedEnvName}
          selectedSetup={selectedSetup}
          onSelectEnv={setSelectedEnvName}
          onSelectSetup={handleSelectSetup}
          onClearSelection={handleClearSelection}
        />
        <Box className={canvasClasses.detailPanelFrame}>
          {selectedSetup ? (
            <ProjectSetupDetailPane
              onConfigureDeploy={handleConfigureDeploy}
              onClose={handleClearSelection}
            />
          ) : (
            <ProjectEnvironmentDetailPanel
              env={selectedEnv}
              onClose={() => setSelectedEnvName(null)}
            />
          )}
        </Box>
      </Box>
    </ProjectEnvironmentsProvider>
  );
};
