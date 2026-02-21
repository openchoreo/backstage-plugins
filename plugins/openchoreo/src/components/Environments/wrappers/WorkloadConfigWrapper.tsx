import { useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useEnvironmentRouting } from '../hooks/useEnvironmentRouting';
import { WorkloadConfigPage } from '../Workload/WorkloadConfigPage';
import type { PendingAction } from '../types';

/**
 * Wrapper component for WorkloadConfigPage that handles URL-based navigation.
 */
export const WorkloadConfigWrapper = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lowestEnvironment } = useEnvironmentsContext();
  const { navigateToList, navigateToOverrides } = useEnvironmentRouting();

  // Get active tab from URL (container, endpoints, connections)
  const activeTab = searchParams.get('tab') || 'container';

  // Handle tab change - update URL
  // When replace is true (default tab initialization), don't add to history
  // When replace is false (user interaction), add to history for back button support
  const handleTabChange = useCallback(
    (tab: string, replace = false) => {
      const newParams = new URLSearchParams(searchParams);
      // Always set tab param for consistency (including first tab)
      newParams.set('tab', tab);
      navigate(`?${newParams.toString()}`, { replace });
    },
    [searchParams, navigate],
  );

  const handleBack = () => {
    navigateToList();
  };

  const handleNext = (releaseName: string, targetEnvironment: string) => {
    const pendingAction: PendingAction = {
      type: 'deploy',
      releaseName,
      targetEnvironment,
    };
    navigateToOverrides(targetEnvironment, pendingAction);
  };

  return (
    <WorkloadConfigPage
      onBack={handleBack}
      onNext={handleNext}
      lowestEnvironment={lowestEnvironment}
      initialTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
};
