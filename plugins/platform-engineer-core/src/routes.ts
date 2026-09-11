import { createRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'platform-engineer-core',
});

// The Platform section. Separate from rootRouteRef (which stays bound to
// /platform-engineer-view via the dashboard page), but this is the plugin's
// `routes.root` in alpha.tsx: the Platform page is the one in the nav, and
// PageBlueprint derives its header's title link from `routes.root`.
//
// Registered on the host page, not on the Overview tab — a route ref registered
// twice resolves to whichever of the two was visited last.
export const platformOverviewRouteRef = createRouteRef({
  id: 'platform-engineer-core.platform-overview',
});
