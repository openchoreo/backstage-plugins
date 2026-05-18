import { mockServices, startTestBackend } from '@backstage/backend-test-utils';

import { openchoreoPortalAssistantBackendPlugin } from './plugin';

describe('openchoreoPortalAssistantBackendPlugin', () => {
  it('starts cleanly when openchoreo.portalAssistantUrl is not set', async () => {
    // The plugin must self-disable rather than crash — the frontend
    // feature flag is the primary gate, so a Backstage that ships the
    // plugin but has no upstream configured should still boot.
    const { server } = await startTestBackend({
      features: [
        openchoreoPortalAssistantBackendPlugin,
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    expect(server).toBeDefined();
  });

  it('starts cleanly with openchoreo.portalAssistantUrl configured', async () => {
    const { server } = await startTestBackend({
      features: [
        openchoreoPortalAssistantBackendPlugin,
        mockServices.rootConfig.factory({
          data: {
            openchoreo: {
              portalAssistantUrl: 'http://example.invalid',
            },
          },
        }),
      ],
    });

    expect(server).toBeDefined();
  });
});
