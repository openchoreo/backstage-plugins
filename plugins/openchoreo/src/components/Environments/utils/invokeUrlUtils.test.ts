import { buildUrl, describeSecurity } from './invokeUrlUtils';

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
