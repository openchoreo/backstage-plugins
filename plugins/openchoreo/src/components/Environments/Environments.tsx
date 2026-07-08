import { useCallback, useMemo, useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';

import { useNotification } from '../../hooks';
import {
  useAutoDeploy,
  useAwaitNewRelease,
  useEnvironmentData,
  useStaleEnvironments,
  useEnvironmentPolling,
  useEnvironmentRouting,
} from './hooks';
import type { PendingAction } from './types';
import { useEnvironmentsStyles } from './styles';
import { EnvironmentsRouter } from './EnvironmentsRouter';
import {
  EnvironmentsProvider,
  type Selection,
  type RenderInvestigateAction,
} from './EnvironmentsContext';
import { NotificationBanner } from './components';
import {
  ForbiddenState,
  useReleaseBindingPermission,
  useEnvironmentReadPermission,
} from '@openchoreo/backstage-plugin-react';

export interface EnvironmentsProps {
  /**
   * Host-app slot for the deploy-panel "investigate" button. Injected by
   * ``packages/app`` (which owns the portal-assistant dependency) and
   * forwarded to the detail panel via context. See
   * ``EnvironmentsContextValue.renderInvestigateAction``.
   */
  renderInvestigateAction?: RenderInvestigateAction;
}

export const Environments = ({
  renderInvestigateAction,
}: EnvironmentsProps = {}) => {
  // Initialize global styles (includes keyframe animation)
  useEnvironmentsStyles();

  const { entity } = useEntity();

  // Routing
  const { navigateToList } = useEnvironmentRouting();

  // Data fetching
  const { environments, loading, error, isForbidden, refetch } =
    useEnvironmentData(entity);
  const { displayEnvironments, isPending } = useStaleEnvironments(environments);

  // Permission checks
  const { canViewEnvironments, loading: environmentReadPermissionLoading } =
    useEnvironmentReadPermission();
  const { canViewBindings, loading: bindingsPermissionLoading } =
    useReleaseBindingPermission();

  // Component-level auto-deploy flag — loaded once and shared via context so
  // child pages don't flicker on their own defaults during initial fetch.
  const {
    autoDeploy,
    latestReleaseName,
    componentError,
    loading: autoDeployLoading,
    refetch: refetchAutoDeploy,
    setAutoDeployOptimistic,
  } = useAutoDeploy(entity);

  // Drives the "Deploying…" pill on the Setup card after a UI save.
  // Polls Component.status.latestRelease.name and the env list until
  // either advances to the new release, the controller reports an error,
  // or 30s passes.
  const { awaitingNewRelease, beginAwaitingNewRelease } = useAwaitNewRelease({
    latestReleaseName,
    hasError: !!componentError,
    refetchAutoDeploy,
    refetchEnvironments: refetch,
  });

  // Notifications
  const notification = useNotification();

  // Canvas selection — lifted here so it survives navigation between the
  // deploy list view and intermediate routes (workload-config / overrides /
  // release-details). The provider mounts above EnvironmentsRouter, so
  // these intermediate-route navigations don't unmount this state.
  const [selection, setSelection] = useState<Selection>(null);

  // Polling for pending deployments
  useEnvironmentPolling(isPending, refetch);

  // Check if workload editor is supported
  const isWorkloadEditorSupported = useMemo(
    () =>
      !!(
        entity.metadata.tags?.find(
          tag => tag === 'webapplication' || tag === 'service',
        ) ||
        entity.metadata.annotations?.['openchoreo.io/component'] !== undefined
      ),
    [entity],
  );

  // Handler for when overrides are saved with a pending action
  // The release binding was already created/updated by updateReleaseBinding
  // in EnvironmentOverridesPage — just show success and refresh
  const handlePendingActionComplete = useCallback(
    async (pendingAction: PendingAction) => {
      try {
        const actionLabel =
          pendingAction.type === 'deploy' ? 'deployed' : 'promoted';
        notification.showSuccess(
          `Successfully ${actionLabel} to ${pendingAction.targetEnvironment}`,
        );
        refetch();
        navigateToList();
      } catch (err: any) {
        notification.showError(
          err.message || `Failed to complete ${pendingAction.type}`,
        );
        navigateToList();
      }
    },
    [notification, refetch, navigateToList],
  );

  // Context value
  const contextValue = useMemo(
    () => ({
      environments,
      displayEnvironments,
      loading,
      error: isForbidden ? undefined : error,
      refetch,
      lowestEnvironment: environments[0]?.name?.toLowerCase() || 'development',
      isWorkloadEditorSupported,
      onPendingActionComplete: handlePendingActionComplete,
      canViewEnvironments,
      environmentReadPermissionLoading,
      canViewBindings,
      bindingsPermissionLoading,
      autoDeploy,
      autoDeployLoading,
      refetchAutoDeploy,
      setAutoDeployOptimistic,
      latestReleaseName,
      componentError,
      awaitingNewRelease,
      beginAwaitingNewRelease,
      selection,
      setSelection,
      renderInvestigateAction,
    }),
    [
      environments,
      displayEnvironments,
      loading,
      error,
      isForbidden,
      refetch,
      isWorkloadEditorSupported,
      handlePendingActionComplete,
      canViewEnvironments,
      environmentReadPermissionLoading,
      canViewBindings,
      bindingsPermissionLoading,
      autoDeploy,
      autoDeployLoading,
      refetchAutoDeploy,
      setAutoDeployOptimistic,
      latestReleaseName,
      componentError,
      awaitingNewRelease,
      beginAwaitingNewRelease,
      selection,
      renderInvestigateAction,
    ],
  );

  // Forbidden state
  if (isForbidden) {
    return (
      <ForbiddenState
        message="You do not have permission to view deployments."
        onRetry={refetch}
        minHeight="400px"
      />
    );
  }

  // Initial load is no longer gated by a generic <Progress /> spinner;
  // PipelineCanvas renders proper LHS + RHS skeletons while
  // `loading && environments.length === 0`, so we always mount the
  // provider and let the router decide what to show.
  return (
    <EnvironmentsProvider value={contextValue}>
      <NotificationBanner notification={notification.notification} />
      <EnvironmentsRouter />
    </EnvironmentsProvider>
  );
};
