import { Routes, Route } from 'react-router-dom';
import { EnvironmentsList } from './EnvironmentsList';
import { WorkloadConfigWrapper } from './wrappers/WorkloadConfigWrapper';
import { OverridesWrapper } from './wrappers/OverridesWrapper';
import { ReleaseDetailsWrapper } from './wrappers/ReleaseDetailsWrapper';

/**
 * Router component for the Environments section.
 *
 * Handles URL-based navigation between:
 * - List view (default): /
 * - Workload config: /workload-config
 * - Overrides: /overrides/:envName
 * - Release details: /release/:envName
 */
export const EnvironmentsRouter = () => {
  return (
    <Routes>
      <Route path="/" element={<EnvironmentsList />} />
      <Route path="/workload-config" element={<WorkloadConfigWrapper />} />
      <Route path="/overrides/:envName" element={<OverridesWrapper />} />
      <Route path="/release/:envName" element={<ReleaseDetailsWrapper />} />
    </Routes>
  );
};
