import { createRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'platform-engineer-core',
});

// Separate from rootRouteRef (which is bound to /platform-engineer-view).
export const platformOverviewRouteRef = createRouteRef({
  id: 'platform-engineer-core.platform-overview',
});
