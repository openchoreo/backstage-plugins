import { mockServices, startTestBackend } from '@backstage/backend-test-utils';

import { openchoreoPerchBackendPlugin } from './plugin';

describe('openchoreoPerchBackendPlugin', () => {
  it('starts cleanly when neither perch.assistantAgentUrl nor openchoreo.assistantAgentUrl is set', async () => {
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

  it('starts cleanly with perch.assistantAgentUrl configured', async () => {
    const { server } = await startTestBackend({
      features: [
        openchoreoPerchBackendPlugin,
        mockServices.rootConfig.factory({
          data: {
            perch: {
              assistantAgentUrl: 'http://example.invalid',
            },
          },
        }),
      ],
    });

    expect(server).toBeDefined();
  });

  it('starts cleanly with the legacy openchoreo.assistantAgentUrl key', async () => {
    // Backwards-compat: existing app-config.yaml uses
    // openchoreo.assistantAgentUrl; the plugin reads either key.
    const { server } = await startTestBackend({
      features: [
        openchoreoPerchBackendPlugin,
        mockServices.rootConfig.factory({
          data: {
            openchoreo: {
              assistantAgentUrl: 'http://example.invalid',
            },
          },
        }),
      ],
    });

    expect(server).toBeDefined();
  });
});
