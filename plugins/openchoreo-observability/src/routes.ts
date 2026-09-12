import { createRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'openchoreo-observability',
});

// The Logs tab of the Platform section. Separate from rootRouteRef (bound to
// /cost-insights): this is a sub-page of the page the platform-engineer-core
// plugin owns, so it resolves to that page's path plus `logs`.
export const platformLogsRouteRef = createRouteRef({
  id: 'openchoreo-observability.platform-logs',
});
