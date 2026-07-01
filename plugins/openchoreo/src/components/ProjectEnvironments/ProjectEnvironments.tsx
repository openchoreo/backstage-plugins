import { Routes, Route } from 'react-router-dom';
import { ProjectEnvironmentsList } from './ProjectEnvironmentsList';
import { ProjectParametersConfigWrapper } from './ProjectParametersConfigWrapper';
import { ProjectEnvironmentOverridesWrapper } from './ProjectEnvironmentOverridesWrapper';

/**
 * Router for the Project entity's `/deploy` tab.
 *
 * Sub-routes:
 * - `/` — deploy view (pipeline DAG + detail panel)
 * - `/parameters-config` — Configure Project wizard
 * - `/overrides/:envName` — per-env override wizard
 */
export const ProjectEnvironments = () => (
  <Routes>
    <Route path="/" element={<ProjectEnvironmentsList />} />
    <Route
      path="/parameters-config"
      element={<ProjectParametersConfigWrapper />}
    />
    <Route
      path="/overrides/:envName"
      element={<ProjectEnvironmentOverridesWrapper />}
    />
  </Routes>
);
