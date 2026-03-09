import { useCallback, useState, useEffect, useMemo } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Progress } from '@backstage/core-components';
import { Box } from '@material-ui/core';
import { useApi } from '@backstage/core-plugin-api';
import { useAsyncRetry } from 'react-use';

import { useNotification } from '../../hooks';
import {
  useEnvironmentData,
  useStaleEnvironments,
  useEnvironmentPolling,
  useEnvironmentRouting,
} from './hooks';
import { useAutoDeployUpdate } from './hooks/useAutoDeployUpdate';
import type { PendingAction } from './types';
import { useEnvironmentsStyles } from './styles';
import { EnvironmentsRouter } from './EnvironmentsRouter';
import { EnvironmentsProvider } from './EnvironmentsContext';
import { NotificationBanner } from './components';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import {
  ForbiddenState,
  useReleaseBindingPermission,
} from '@openchoreo/backstage-plugin-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { isForbiddenError } from '../../utils/errorUtils';

export const Environments = () => {
  // Initialize global styles (includes keyframe animation)
  useEnvironmentsStyles();

  const { entity } = useEntity();
  const client = useApi(openChoreoClientApiRef);

  // Routing
  const { navigateToList } = useEnvironmentRouting();

  // Data fetching
  const { environments, loading, isForbidden, refetch } =
    useEnvironmentData(entity);
  const { displayEnvironments, isPending } = useStaleEnvironments(environments);

  // Pipeline fetch for permission detection
  const projectName = entity.metadata.annotations?.[CHOREO_ANNOTATIONS.PROJECT];
  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];

  const { value: pipelineData, error: pipelineError } =
    useAsyncRetry(async () => {
      if (!projectName || !namespaceName) return null;
      return client.fetchDeploymentPipeline(projectName, namespaceName);
    }, [projectName, namespaceName, client]);

  // If the pipeline indicates environments should exist but user can't see them
  const pipelineUnavailable =
    isForbiddenError(pipelineError) ||
    ((pipelineData?.promotionPaths?.length ?? 0) > 0 &&
      environments.length === 0 &&
      !loading);

  // Permission check for release binding access
  const { canViewBindings } = useReleaseBindingPermission();

  // Auto deploy state
  const [autoDeploy, setAutoDeploy] = useState<boolean | undefined>(undefined);
  const { updateAutoDeploy, isUpdating: autoDeployUpdating } =
    useAutoDeployUpdate(entity);

  // Notifications
  const notification = useNotification();

  // Fetch component details to get autoDeploy value
  useEffect(() => {
    const fetchComponentData = async () => {
      try {
        const componentData = await client.getComponentDetails(entity);
        if (componentData && 'autoDeploy' in componentData) {
          setAutoDeploy((componentData as any).autoDeploy);
        }
      } catch (err) {
        // Silently fail - autoDeploy will remain undefined
      }
    };

    fetchComponentData();
  }, [entity, client]);

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

  // Handler for auto deploy toggle change
  const handleAutoDeployChange = useCallback(
    async (newAutoDeploy: boolean) => {
      const success = await updateAutoDeploy(newAutoDeploy);
      if (success) {
        setAutoDeploy(newAutoDeploy);
        notification.showSuccess(
          `Auto deploy ${newAutoDeploy ? 'enabled' : 'disabled'} successfully`,
        );
      } else {
        notification.showError('Failed to update auto deploy setting');
      }
    },
    [updateAutoDeploy, notification],
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
      autoDeploy,
      autoDeployUpdating,
      onAutoDeployChange: handleAutoDeployChange,
      onPendingActionComplete: handlePendingActionComplete,
      pipelineUnavailable,
      canViewBindings,
    }),
    [
      environments,
      displayEnvironments,
      loading,
      refetch,
      isWorkloadEditorSupported,
      autoDeploy,
      autoDeployUpdating,
      handleAutoDeployChange,
      handlePendingActionComplete,
      pipelineUnavailable,
      canViewBindings,
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
