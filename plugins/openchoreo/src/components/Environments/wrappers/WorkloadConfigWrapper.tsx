import { useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useEnvironmentsContext } from '../EnvironmentsContext';
import { useEnvironmentRouting } from '../hooks/useEnvironmentRouting';
import { WorkloadConfigPage } from '../Workload/WorkloadConfigPage';

/**
 * Wrapper component for WorkloadConfigPage that handles URL-based navigation.
 *
 * Saving workload + traits/parameters returns the user to the deploy list
 * view; release creation is owned by the Set up panel there.
 */
export const WorkloadConfigWrapper = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { lowestEnvironment, environments } = useEnvironmentsContext();
  const lowestEnv = environments.find(
    env => env.name?.toLowerCase() === lowestEnvironment,
  );
  const envDataPlane = lowestEnv
    ? { kind: lowestEnv.dataPlaneKind, name: lowestEnv.dataPlaneRef }
    : undefined;
  const { navigateToList } = useEnvironmentRouting();

  const activeTab = searchParams.get('tab') || 'container';

  const handleTabChange = useCallback(
    (tab: string, replace = false) => {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('tab', tab);
      navigate(`?${newParams.toString()}`, { replace });
    },
    [searchParams, navigate],
  );

  return (
    <WorkloadConfigPage
      onBack={navigateToList}
      onSaved={navigateToList}
      lowestEnvDataPlane={envDataPlane}
      initialTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
};
