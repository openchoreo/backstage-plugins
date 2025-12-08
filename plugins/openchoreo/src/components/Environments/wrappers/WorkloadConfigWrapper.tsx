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

  // Get active tab from URL (containers, endpoints, connections)
  const activeTab = searchParams.get('tab') || 'containers';

  // Handle tab change - update URL without replace to allow back navigation
  const handleTabChange = useCallback(
    (tab: string) => {
      const newParams = new URLSearchParams(searchParams);
      // Always set tab param for consistency (including first tab)
      newParams.set('tab', tab);
      navigate(`?${newParams.toString()}`, { replace: false });
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
