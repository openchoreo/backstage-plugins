import { mockErrorHandler } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import { createRouter } from './router';
import type { ImageSecurityService } from './services/ImageSecurityService';

describe('createRouter', () => {
  let app: express.Express;
  let getComponentImageSecurity: jest.Mock;

  beforeEach(async () => {
    getComponentImageSecurity = jest
      .fn()
      .mockResolvedValue({ severities: ['CRITICAL'], environments: [] });
    const tokenService = {
      getUserToken: jest.fn().mockReturnValue(undefined),
      getUserTokenRequired: jest.fn(),
      getServiceToken: jest.fn(),
      hasServiceCredentials: jest.fn().mockReturnValue(false),
    } as unknown as OpenChoreoTokenService;
    const router = await createRouter({
      imageSecurityService: {
        getComponentImageSecurity,
      } as unknown as ImageSecurityService,
      tokenService,
    });
    app = express();
    app.use(router);
    app.use(mockErrorHandler());
  });

  it('returns the image security of a component', async () => {
    const response = await request(app)
      .get('/vulnerabilities')
      .query({ namespaceName: 'acme', componentName: 'web' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      severities: ['CRITICAL'],
      environments: [],
    });
    expect(getComponentImageSecurity).toHaveBeenCalledWith(
      'acme',
      'web',
      undefined,
    );
  });

  it('rejects missing parameters', async () => {
    const response = await request(app)
      .get('/vulnerabilities')
      .query({ namespaceName: 'acme' });

    expect(response.status).toBe(400);
    expect(getComponentImageSecurity).not.toHaveBeenCalled();
  });

  it('rejects repeated parameters', async () => {
    const response = await request(app).get(
      '/vulnerabilities?namespaceName=a&namespaceName=b&componentName=web',
    );

    expect(response.status).toBe(400);
    expect(getComponentImageSecurity).not.toHaveBeenCalled();
  });
});
