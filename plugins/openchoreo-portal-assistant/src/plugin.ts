import {
  createApiFactory,
  createPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import {
  PortalAssistantClient,
  portalAssistantApiRef,
} from './api/PortalAssistantApi';

/**
 * openchoreo-portal-assistant — the OpenChoreo Portal Assistant for Backstage.
 *
 * This is an internal-only plugin: it's deployed as part of the OpenChoreo
 * Backstage app and has no third-party consumers. The shell exists so
 * consumers can do ``useApi(portalAssistantApiRef)`` instead of constructing the
 * client by hand.
 *
 * NOTE: the ``apis`` array below is never read at runtime — this plugin
 * registers no routable or component extension, so the loader never visits
 * it. The factory that actually gets wired lives in ``../alpha``.
 *
 * UI components (drawer provider, launchers) are exported directly
 * from {@link ./index} as plain React components — they are NOT wrapped in
 * ``createComponentExtension``. Lazy-loading the leaf launchers via the
 * extension API would save ~5 KB of bundle that's already on the critical
 * path of every entity page; the indirection costs more than it saves at
 * this size. If a future component grows large enough that lazy-loading
 * matters, wrap that one specifically.
 */
export const openchoreoPortalAssistantPlugin = createPlugin({
  id: 'openchoreo-portal-assistant',
  apis: [
    createApiFactory({
      api: portalAssistantApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new PortalAssistantClient({ discoveryApi, fetchApi }),
    }),
  ],
});
