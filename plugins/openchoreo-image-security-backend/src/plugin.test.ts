import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { generateKeyPairSync } from 'crypto';
import request from 'supertest';
import { openchoreoImageSecurityBackendPlugin } from './plugin';

describe('openchoreoImageSecurityBackendPlugin', () => {
  it('serves no routes without openchoreo.imageSecurity', async () => {
    const { server } = await startTestBackend({
      features: [
        openchoreoImageSecurityBackendPlugin,
        mockServices.rootConfig.factory({
          data: { openchoreo: { baseUrl: 'http://openchoreo-api' } },
        }),
      ],
    });

    const response = await request(server).get(
      '/api/openchoreo-image-security-backend/vulnerabilities',
    );
    expect(response.status).toBe(404);
  });

  it('serves the vulnerabilities route when configured', async () => {
    const publicKey = generateKeyPairSync('ec', { namedCurve: 'P-256' })
      .publicKey.export({ type: 'spki', format: 'pem' })
      .toString();
    const { server } = await startTestBackend({
      features: [
        openchoreoImageSecurityBackendPlugin,
        mockServices.rootConfig.factory({
          data: {
            openchoreo: {
              baseUrl: 'http://openchoreo-api',
              imageSecurity: {
                publicKey,
                registries: [{ host: 'registry.example.com' }],
              },
            },
          },
        }),
      ],
    });

    // Missing parameters are rejected by the router before any API call.
    const response = await request(server).get(
      '/api/openchoreo-image-security-backend/vulnerabilities',
    );
    expect(response.status).toBe(400);
  });
});
