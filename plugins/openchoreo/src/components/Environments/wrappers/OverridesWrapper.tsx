import { useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Box, Typography, Button } from '@material-ui/core';
import { deserializePendingAction } from '@openchoreo/backstage-plugin-react';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useEnvironmentRouting } from '../hooks/useEnvironmentRouting';
import { EnvironmentOverridesPage } from '../EnvironmentOverridesPage';
import type { Environment } from '../hooks/useEnvironmentData';

/**
 * Wrapper component for EnvironmentOverridesPage that handles URL-based navigation.
 * Reads envName from URL params and pendingAction from query params.
 */
export const OverridesWrapper = () => {
  const { envName } = useParams<{ envName: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { entity } = useEntity();
  const { environments, refetch, onPendingActionComplete } =
    useEnvironmentsContext();
  const { navigateToList, navigateToWorkloadConfig } = useEnvironmentRouting();

  // Parse pending action from URL
  const pendingAction = useMemo(
    () => deserializePendingAction(searchParams),
    [searchParams],
  );

  // Get active tab from URL
  const activeTab = searchParams.get('tab') || '';

  // Handle tab change - update URL
  // When replace is true (default tab initialization), don't add to history
  // When replace is false (user interaction), add to history for back button support
  const handleTabChange = useCallback(
    (tabId: string, replace = false) => {
      const newParams = new URLSearchParams(searchParams);
      if (tabId) {
        newParams.set('tab', tabId);
      } else {
        newParams.delete('tab');
      }
      navigate(`?${newParams.toString()}`, { replace });
    },
    [searchParams, navigate],
  );

  // Find the environment by name
  const environment = useMemo<Environment | undefined>(() => {
    if (!envName) return undefined;

    const decodedName = decodeURIComponent(envName);

    // First try to find by exact name match
    let env = environments.find(
      e => e.name.toLowerCase() === decodedName.toLowerCase(),
    );

    // If not found and we have a pending action, create a minimal environment object
    // This handles the case where we're deploying to an environment for the first time
    if (!env && pendingAction) {
      env = {
        name: decodedName,
        deployment: {
          releaseName: pendingAction.releaseName,
        },
        endpoints: [],
      };
    }

    return env;
  }, [envName, environments, pendingAction]);

  const handleBack = () => {
    navigateToList();
  };

  const handleSaved = () => {
    refetch();
  };

  const handlePrevious =
    pendingAction?.type === 'deploy'
      ? () => navigateToWorkloadConfig()
      : undefined;

  // Error state: environment not found
  if (!environment) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight={300}
        p={4}
      >
        <Typography variant="h6" gutterBottom>
          Environment Not Found
        </Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          The environment "{envName}" could not be found.
        </Typography>
        <Button variant="outlined" onClick={handleBack}>
          Back to Environments
        </Button>
      </Box>
    );
  }

  return (
    <EnvironmentOverridesPage
      environment={environment}
      entity={entity}
      onBack={handleBack}
      onSaved={handleSaved}
      pendingAction={pendingAction}
      onPendingActionComplete={onPendingActionComplete}
      onPrevious={handlePrevious}
      initialTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
};
