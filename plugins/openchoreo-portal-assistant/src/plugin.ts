import {
  createApiFactory,
  createPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import { PerchAgentClient, perchAgentApiRef } from './api/PerchAgentApi';

/**
 * openchoreo-portal-assistant — the OpenChoreo Portal Assistant for Backstage.
 *
 * This is an internal-only plugin: it's deployed as part of the OpenChoreo
 * Backstage app and has no third-party consumers. The shell exists so
 * consumers can do ``useApi(perchAgentApiRef)`` instead of constructing the
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
export const openchoreoPerchPlugin = createPlugin({
  id: 'openchoreo-portal-assistant',
  apis: [
    createApiFactory({
      api: perchAgentApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new PerchAgentClient({ discoveryApi, fetchApi }),
    }),
  ],
});
