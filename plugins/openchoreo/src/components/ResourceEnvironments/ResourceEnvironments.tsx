import { Routes, Route } from 'react-router-dom';
import { ResourceEnvironmentsList } from './ResourceEnvironmentsList';
import { ResourceParametersConfigWrapper } from './ResourceParametersConfigWrapper';

/**
 * Router for the Resource entity's `/environments` tab.
 *
 * Sub-routes:
 * - `/` — deploy view (canvas + detail panel)
 * - `/parameters-config` — Step 1 wizard (Configure Resource)
 *
 * Phase B-3 will add `/overrides/:envName` for the Step 2 wizard.
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
