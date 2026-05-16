import { Routes, Route } from 'react-router-dom';
import { ResourceEnvironmentsList } from './ResourceEnvironmentsList';
import { ResourceParametersConfigWrapper } from './ResourceParametersConfigWrapper';
import { ResourceEnvironmentOverridesWrapper } from './ResourceEnvironmentOverridesWrapper';

/**
 * Router for the Resource entity's `/environments` tab.
 *
 * Sub-routes:
 * - `/` — deploy view (canvas + detail panel)
 * - `/parameters-config` — Configure Resource wizard
 * - `/overrides/:envName` — per-env override wizard
 */
export const ResourceEnvironments = () => (
  <Routes>
    <Route path="/" element={<ResourceEnvironmentsList />} />
    <Route
      path="/parameters-config"
      element={<ResourceParametersConfigWrapper />}
    />
    <Route
      path="/overrides/:envName"
      element={<ResourceEnvironmentOverridesWrapper />}
    />
  </Routes>
);
