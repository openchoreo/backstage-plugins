import { mockServices } from '@backstage/backend-test-utils';
import { WirelogsInfoService } from './WirelogsInfoService';

const mockFetch = jest.fn();
const originalFetch = global.fetch;
beforeAll(() => {
  (global as any).fetch = mockFetch;
});
afterAll(() => {
  (global as any).fetch = originalFetch;
});

const logger = mockServices.logger.mock();

describe('WirelogsInfoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds the upstream URL from baseUrl + namespace/environment, with project as a query param', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    const service = new WirelogsInfoService(logger, 'http://api.openchoreo');
    const controller = new AbortController();

    await service.openStream(
      {
        namespaceName: 'team-a',
        environmentName: 'dev',
        projectName: 'proj-x',
      },
      undefined,
      controller.signal,
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'http://api.openchoreo/api/v1/namespaces/team-a/environments/dev/wirelogs?project=proj-x',
    );
    expect(init.method).toBe('GET');
    expect(init.headers).toEqual({ Accept: 'text/event-stream' });
    expect(init.signal).toBe(controller.signal);
  });

  it('strips a trailing /api/v1 from the configured base URL so the path is not doubled', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    const service = new WirelogsInfoService(
      logger,
      'http://api.openchoreo/api/v1',
    );

    await service.openStream(
      {
        namespaceName: 'team',
        environmentName: 'dev',
        projectName: 'proj',
      },
      undefined,
      new AbortController().signal,
    );

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'http://api.openchoreo/api/v1/namespaces/team/environments/dev/wirelogs?project=proj',
    );
  });

  it('also strips a trailing /api/v1/ (with slash)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    const service = new WirelogsInfoService(
      logger,
      'http://api.openchoreo/api/v1/',
    );

    await service.openStream(
      {
        namespaceName: 'team',
        environmentName: 'dev',
        projectName: 'proj',
      },
      undefined,
      new AbortController().signal,
    );

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'http://api.openchoreo/api/v1/namespaces/team/environments/dev/wirelogs?project=proj',
    );
  });

  it('appends the component query parameter when supplied', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    const service = new WirelogsInfoService(logger, 'http://api.openchoreo');

    await service.openStream(
      {
        namespaceName: 'team',
        environmentName: 'dev',
        projectName: 'proj',
        componentName: 'svc',
      },
      'tok',
      new AbortController().signal,
    );

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('component=svc');
  });

  it('attaches a Bearer token when one is supplied', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    const service = new WirelogsInfoService(logger, 'http://api.openchoreo');

    await service.openStream(
      {
        namespaceName: 'team',
        environmentName: 'dev',
        projectName: 'proj',
      },
      'my-token',
      new AbortController().signal,
    );

    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).toEqual({
      Accept: 'text/event-stream',
      Authorization: 'Bearer my-token',
    });
  });

  it('URL-encodes namespace and environment path segments', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true } as Response);
    const service = new WirelogsInfoService(logger, 'http://api.openchoreo');

    await service.openStream(
      {
        namespaceName: 'team space',
        environmentName: 'dev/uat',
        projectName: 'proj',
      },
      undefined,
      new AbortController().signal,
    );

    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/namespaces/team%20space/');
    expect(url).toContain('/environments/dev%2Fuat/');
  });
});
