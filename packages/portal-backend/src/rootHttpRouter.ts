import { rootHttpRouterServiceFactory } from '@backstage/backend-defaults/rootHttpRouter';
import { createIdpTokenHeaderMiddleware } from '@openchoreo/openchoreo-auth';

/**
 * Root HTTP router service factory pre-configured with the OpenChoreo IDP
 * token header middleware.
 *
 * The middleware reads the IDP token from the x-openchoreo-token header and
 * establishes the AsyncLocalStorage context so getUserTokenFromContext() works
 * in the permission policy and elsewhere. It must wrap ALL route handlers,
 * which is why it is registered on the root HTTP router before applyDefaults().
 *
 * Included in {@link portalBackendFeatures}; exported separately for hosts
 * that compose their own backend from `portalServiceFactories` and
 * `portalFeatureLoaders`.
 *
 * @public
 */
export const portalRootHttpRouterServiceFactory = rootHttpRouterServiceFactory({
  configure: ({ app, applyDefaults }) => {
    // Registered before applyDefaults() so it wraps all route handlers.
    app.use(createIdpTokenHeaderMiddleware());

    // applyDefaults() applies the standard middleware stack ONCE:
    // helmet, cors, compression, logging, rateLimit, then routes + error
    // handling. Do NOT re-apply any of these manually here.
    applyDefaults();
  },
});
