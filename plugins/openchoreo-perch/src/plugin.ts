import {
  createApiFactory,
  createPlugin,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import {
  AssistantAgentClient,
  assistantAgentApiRef,
} from './api/AssistantAgentApi';

/**
 * openchoreo-perch — the OpenChoreo AI assistant ("Perch") for Backstage.
 *
 * This is an internal-only plugin: it's deployed as part of the OpenChoreo
 * Backstage app and has no third-party consumers. The plugin shell exists
 * for one specific reason — to register the ``assistantAgentApiRef`` API
 * factory through Backstage's idiomatic apiRef pattern, so consumers do
 * ``useApi(assistantAgentApiRef)`` instead of constructing the client by
 * hand.
 *
 * UI components (FAB, drawer provider, launchers) are exported directly
 * from {@link ./index} as plain React components — they are NOT wrapped in
 * ``createComponentExtension``. Lazy-loading the leaf launchers via the
 * extension API would save ~5 KB of bundle that's already on the critical
 * path of every entity page; the indirection costs more than it saves at
 * this size. If a future component grows large enough that lazy-loading
 * matters, wrap that one specifically.
 */
export const openchoreoPerchPlugin = createPlugin({
  id: 'openchoreo-perch',
  apis: [
    createApiFactory({
      api: assistantAgentApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new AssistantAgentClient({ discoveryApi, fetchApi }),
    }),
  ],
});
