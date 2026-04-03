import { useCallback, useMemo } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Progress } from '@backstage/core-components';
import { Box } from '@material-ui/core';

import { useNotification } from '../../hooks';
import {
  useEnvironmentData,
  useStaleEnvironments,
  useEnvironmentPolling,
  useEnvironmentRouting,
} from './hooks';
import type { PendingAction } from './types';
import { useEnvironmentsStyles } from './styles';
import { EnvironmentsRouter } from './EnvironmentsRouter';
import { EnvironmentsProvider } from './EnvironmentsContext';
import { NotificationBanner } from './components';
import {
  ForbiddenState,
  useReleaseBindingPermission,
  useEnvironmentReadPermission,
} from '@openchoreo/backstage-plugin-react';

export const Environments = () => {
  // Initialize global styles (includes keyframe animation)
  useEnvironmentsStyles();

  const { entity } = useEntity();

  // Routing
  const { navigateToList } = useEnvironmentRouting();

  // Data fetching
  const { environments, loading, isForbidden, refetch } =
    useEnvironmentData(entity);
  const { displayEnvironments, isPending } = useStaleEnvironments(environments);

  // Permission checks
  const { canViewEnvironments, loading: environmentReadPermissionLoading } =
    useEnvironmentReadPermission();
  const { canViewBindings, loading: bindingsPermissionLoading } =
    useReleaseBindingPermission();

  // Notifications
  const notification = useNotification();

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
      refetch,
      lowestEnvironment: environments[0]?.name?.toLowerCase() || 'development',
      isWorkloadEditorSupported,
      onPendingActionComplete: handlePendingActionComplete,
      canViewEnvironments,
      environmentReadPermissionLoading,
      canViewBindings,
      bindingsPermissionLoading,
    }),
    [
      environments,
      displayEnvironments,
      loading,
      refetch,
      isWorkloadEditorSupported,
      handlePendingActionComplete,
      canViewEnvironments,
      environmentReadPermissionLoading,
      canViewBindings,
      bindingsPermissionLoading,
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

  // Loading state - only show initial loading spinner
  if (loading && environments.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <Progress />
      </Box>
    );
  }

  return (
    <EnvironmentsProvider value={contextValue}>
      <NotificationBanner notification={notification.notification} />
      <EnvironmentsRouter />
    </EnvironmentsProvider>
  );
};
