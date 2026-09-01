import { createRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'openchoreo-observability',
});

// The Logs tab of the Platform section. Separate from rootRouteRef (bound to
// /cost-insights): this page mounts under the path the platform-engineer-core
// plugin owns, because the two are tabs of one section.
export const platformLogsRouteRef = createRouteRef({
  id: 'openchoreo-observability.platform-logs',
});
