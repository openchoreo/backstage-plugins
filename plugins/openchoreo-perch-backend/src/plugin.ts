import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';

import { createRouter } from './router';

/**
 * openchoreo-perch-backend — thin Backstage backend plugin that forwards
 * requests from the Perch frontend to the external `assistant-agent`
 * service in the OpenChoreo control plane.
 *
 * Why this exists vs. the Backstage `proxy` plugin: see
 * plugins/openchoreo-perch/README.md for the architectural rationale and
 * trigger conditions. Today this plugin is a forwarder; future work
 * (Backstage permission gating, server-side scope enrichment, multi-
 * backend routing) lives in this same package and is the reason it's a
 * proper plugin instead of a proxy entry.
 *
 * The forwarder is streaming-aware: ``/chat`` returns ndjson the
 * frontend consumes incrementally, so the handler pipes the upstream
 * response body byte-for-byte instead of buffering it (which would
 * defeat the streaming protocol and risk OOM on long turns).
 */
export const openchoreoPerchBackendPlugin = createBackendPlugin({
  pluginId: 'openchoreo-perch-backend',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        // Two acceptable config locations, in priority order:
        //   1. ``perch.assistantAgentUrl`` — explicit, future-proof key.
        //   2. ``openchoreo.assistantAgentUrl`` — the legacy key that the
        //      app-config.yaml proxy entry already uses.
        // Either keeps existing deploys working without a values change.
        const targetUrl =
          config.getOptionalString('perch.assistantAgentUrl') ??
          config.getOptionalString('openchoreo.assistantAgentUrl');

        if (!targetUrl) {
          // Match the disabled-feature ergonomics of the other OpenChoreo
          // backend plugins: log + skip route registration when the
          // upstream isn't configured. Frontend feature flag
          // (OPENCHOREO_FEATURES_ASSISTANT_ENABLED) should already gate
          // the UI in that case, so this is a defence-in-depth log.
          logger.info(
            'openchoreo-perch-backend disabled — neither perch.assistantAgentUrl ' +
              'nor openchoreo.assistantAgentUrl is set in app-config.',
          );
          return;
        }

        logger.info(`openchoreo-perch-backend forwarding to ${targetUrl}`);

        httpRouter.use(
          await createRouter({
            logger,
            targetUrl,
          }),
        );

        // Allow unauthenticated access at the Backstage backend layer —
        // the ``assistant-agent`` validates the Bearer JWT itself
        // (against Thunder JWKS) and runs its own authz check
        // (``assistant:invoke`` plus per-tool actions). Adding a second
        // gate here would be redundant AND would break service-account
        // tokens that don't carry a Backstage identity.
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
