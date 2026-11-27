import { Routes, Route } from 'react-router-dom';
import { EndpointEnvironmentsList } from './EndpointEnvironmentsList';
import { EndpointEnvironmentOverridesWrapper } from './EndpointEnvironmentOverridesWrapper';
import { BackendPageRoute } from './traffic/BackendPage';
import { EndpointArtifactsPage } from './EndpointArtifactsPage';

/**
 * Router for the Endpoint entity's `/environments` (Deploy) tab.
 *
 * Sub-routes:
 * - `/` — deploy view (canvas + detail panel)
 * - `/overrides/:envName` — per-environment overrides
 * - `/add-backend`, `/backend/:name` — add a backend, or change how one gets traffic
 * - `/artifacts/:envName` — the live Kubernetes resources in an environment
 */
export const EndpointEnvironments = () => (
  <Routes>
    <Route path="/" element={<EndpointEnvironmentsList />} />
    <Route
      path="/overrides/:envName"
      element={<EndpointEnvironmentOverridesWrapper />}
    />
    <Route path="/add-backend" element={<BackendPageRoute />} />
    <Route path="/backend/:name" element={<BackendPageRoute />} />
    <Route path="/artifacts/:envName" element={<EndpointArtifactsPage />} />
  </Routes>
);
