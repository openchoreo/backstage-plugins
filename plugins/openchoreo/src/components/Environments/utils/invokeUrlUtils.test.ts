import {
  buildUrl,
  describeSecurity,
  derivePrimaryUrl,
  projectUrlOf,
} from './invokeUrlUtils';

describe('buildUrl', () => {
  it('joins scheme, host, port and path', () => {
    expect(
      buildUrl({
        scheme: 'https',
        host: 'a.example.com',
        port: 443,
        path: '/x',
      }),
    ).toBe('https://a.example.com:443/x');
  });

  it('leaves out a missing scheme and port', () => {
    expect(buildUrl({ scheme: '', host: 'a.dp.svc', port: 9000 })).toBe(
      'a.dp.svc:9000',
    );
    expect(buildUrl({ scheme: 'http', host: 'a.dp.svc', port: 0 })).toBe(
      'http://a.dp.svc',
    );
  });
});

describe('describeSecurity', () => {
  it('names what a caller must present', () => {
    expect(
      describeSecurity({
        scheme: 'apiKey',
        apiKey: { in: 'query', name: 'key' },
      }),
    ).toBe('API key (query key)');
    expect(describeSecurity({ scheme: 'apiKey' })).toBe('API key');
    expect(describeSecurity({ scheme: 'oauth2' })).toBe('OAuth2');
    expect(describeSecurity({ scheme: 'basicAuth' })).toBe('Basic auth');
    expect(describeSecurity({ scheme: 'none' })).toBe('No authentication');
    expect(describeSecurity(undefined)).toBeNull();
  });
});

describe('derivePrimaryUrl', () => {
  it('falls back from external to internal, namespace and project', () => {
    expect(
      derivePrimaryUrl([
        {
          name: 'http',
          namespaceURLs: {
            http: { scheme: 'http', host: 'ns.local', port: 0 },
          },
          serviceURL: { scheme: 'http', host: 'svc', port: 8080 },
        },
      ]),
    ).toEqual({ label: 'Namespace', url: 'http://ns.local' });
    expect(
      derivePrimaryUrl([
        {
          name: 'http',
          serviceURL: { scheme: 'http', host: 'svc', port: 8080 },
        },
      ]),
    ).toEqual({ label: 'Project', url: 'http://svc:8080' });
    expect(derivePrimaryUrl([{ name: 'http' }])).toBeNull();
  });
});

describe('projectUrlOf', () => {
  it("prefers an Endpoint's project URL, with its path, over the service URL", () => {
    expect(
      projectUrlOf({
        name: 'http',
        projectURL: { scheme: 'http', host: 'p.local', port: 0, path: '/a' },
        serviceURL: { scheme: 'http', host: 'svc', port: 8080 },
      }),
    ).toBe('http://p.local/a');
    expect(
      projectUrlOf({
        name: 'http',
        serviceURL: { scheme: 'http', host: 'svc', port: 8080 },
      }),
    ).toBe('http://svc:8080');
  });
});
