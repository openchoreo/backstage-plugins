import { mockServices, startTestBackend } from '@backstage/backend-test-utils';

import { openchoreoPerchBackendPlugin } from './plugin';

describe('openchoreoPerchBackendPlugin', () => {
  it('starts cleanly when openchoreo.perchAgentUrl is not set', async () => {
    // The plugin must self-disable rather than crash — the frontend
    // feature flag is the primary gate, so a Backstage that ships the
    // plugin but has no upstream configured should still boot.
    const { server } = await startTestBackend({
      features: [
        openchoreoPerchBackendPlugin,
        mockServices.rootConfig.factory({ data: {} }),
      ],
    });

    expect(server).toBeDefined();
  });

  it('starts cleanly with openchoreo.perchAgentUrl configured', async () => {
    const { server } = await startTestBackend({
      features: [
        openchoreoPerchBackendPlugin,
        mockServices.rootConfig.factory({
          data: {
            openchoreo: {
              perchAgentUrl: 'http://example.invalid',
            },
          },
        }),
      ],
    });

    expect(server).toBeDefined();
  });
});
