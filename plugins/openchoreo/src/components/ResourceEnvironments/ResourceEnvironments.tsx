import { Routes, Route } from 'react-router-dom';
import { ResourceEnvironmentsList } from './ResourceEnvironmentsList';
import { ResourceParametersConfigWrapper } from './ResourceParametersConfigWrapper';

/**
 * Router for the Resource entity's `/environments` tab.
 *
 * Sub-routes:
 * - `/` — deploy view (canvas + detail panel)
 * - `/parameters-config` — Configure Resource wizard
 */
export const ResourceEnvironments = () => (
  <Routes>
    <Route path="/" element={<ResourceEnvironmentsList />} />
    <Route
      path="/parameters-config"
      element={<ResourceParametersConfigWrapper />}
    />
  </Routes>
);
