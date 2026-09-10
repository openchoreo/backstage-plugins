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
