import { mockComponentEntity } from '@openchoreo/test-utils';
import { ImageSecurityClient } from './ImageSecurityApi';

describe('ImageSecurityClient', () => {
  const discovery = {
    getBaseUrl: jest.fn().mockResolvedValue('http://backend/api/sec'),
  };

  it('queries the backend with the component and namespace', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ severities: [], environments: [] })),
      );
    const client = new ImageSecurityClient(discovery, { fetch });

    const result = await client.getComponentImageSecurity(
      mockComponentEntity({
        annotations: { 'openchoreo.io/component': 'web' },
      }),
    );

    expect(result).toEqual({ severities: [], environments: [] });
    expect(discovery.getBaseUrl).toHaveBeenCalledWith(
      'openchoreo-image-security-backend',
    );
    const url = new URL(fetch.mock.calls[0][0]);
    expect(url.pathname).toBe('/api/sec/vulnerabilities');
    expect(url.searchParams.get('componentName')).toBe('web');
    expect(url.searchParams.get('namespaceName')).toBe('test-ns');
  });

  it('rejects entities that are not OpenChoreo components', async () => {
    const client = new ImageSecurityClient(discovery, { fetch: jest.fn() });

    await expect(
      client.getComponentImageSecurity(mockComponentEntity()),
    ).rejects.toThrow('not an OpenChoreo component');
  });

  it('surfaces backend errors', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(
        new Response('nope', { status: 503, statusText: 'Unavailable' }),
      );
    const client = new ImageSecurityClient(discovery, { fetch });

    await expect(
      client.getComponentImageSecurity(
        mockComponentEntity({
          annotations: { 'openchoreo.io/component': 'web' },
        }),
      ),
    ).rejects.toThrow('503');
  });
});
