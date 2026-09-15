import { createRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'openchoreo-observability',
});

// Separate from rootRouteRef, which the cost insights page is bound to. Two
// pages sharing one ref would leave useRouteRef unable to say which path it
// means -- the same reason platform-engineer-core gives its second page its own.
export const deliveryInsightsRouteRef = createRouteRef({
  id: 'openchoreo-observability.delivery-insights',
});

// The Logs tab of the Platform section. Separate from rootRouteRef (bound to
// /cost-insights): this is a sub-page of the page the platform-engineer-core
// plugin owns, so it resolves to that page's path plus `logs`.
export const platformLogsRouteRef = createRouteRef({
  id: 'openchoreo-observability.platform-logs',
});

/**
 * The Audit Logs page's own route. A separate ref from `rootRouteRef`, which
 * the Cost Insights page is already bound to — one ref cannot name two paths.
 */
export const auditLogsRouteRef = createRouteRef({
  id: 'openchoreo-observability.audit-logs',
});
