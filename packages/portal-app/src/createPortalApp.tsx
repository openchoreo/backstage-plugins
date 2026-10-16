import { createApp } from '@backstage/frontend-defaults';
import type { FrontendFeature } from '@backstage/frontend-plugin-api';
import { PageLoader } from '@openchoreo/backstage-design-system';

import portalFeatureLoader from './alpha';

/** Options for {@link createPortalApp}. */
export interface PortalAppOptions {
  /**
   * Additional frontend features (plugins/modules) appended after the
   * portal's own. Use this to add your plugins to a custom portal.
   */
  features?: FrontendFeature[];
}

/**
 * Assembles the OpenChoreo Portal frontend app in one call, for a host that
 * would rather not configure anything: `createPortalApp().createRoot()`.
 *
 * This is a convenience over the discovery path, not an alternative
 * composition. The features come from the same default-exported loader
 * discovery uses (`./alpha`), so the two cannot drift — and a host that
 * enables `app.packages` *and* calls this gets the portal once, since feature
 * loaders are de-duplicated by reference.
 *
 * The only thing this adds is the branded `loadingElement`, which no feature
 * can contribute: it is the Suspense fallback `createApp` renders before any
 * feature has loaded. Apps that compose `createApp` themselves should pass
 * `advanced.loadingElement` to avoid falling back to Backstage's spinner.
 *
 * Route bindings are deliberately absent. All five bindings the portal needs
 * (catalog → scaffolder/techdocs, scaffolder → catalog-import/techdocs) are
 * already each external route ref's upstream `defaultTarget`, which
 * `resolveRouteBindings` applies when nothing binds them explicitly.
 */
export function createPortalApp(options?: PortalAppOptions) {
  return createApp({
    features: [portalFeatureLoader, ...(options?.features ?? [])],
    advanced: {
      loadingElement: <PageLoader />,
    },
  });
}
