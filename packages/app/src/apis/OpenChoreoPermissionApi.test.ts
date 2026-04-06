import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { OpenChoreoPermissionApi } from './OpenChoreoPermissionApi';

const mockFetch = jest.fn();

const mockConfig = {
  getOptionalBoolean: jest.fn(),
  has: jest.fn(),
  keys: jest.fn(),
  get: jest.fn(),
  getOptional: jest.fn(),
  getConfig: jest.fn(),
  getOptionalConfig: jest.fn(),
  getConfigArray: jest.fn(),
  getOptionalConfigArray: jest.fn(),
  getNumber: jest.fn(),
  getOptionalNumber: jest.fn(),
  getBoolean: jest.fn(),
  getString: jest.fn(),
  getOptionalString: jest.fn(),
  getStringArray: jest.fn(),
  getOptionalStringArray: jest.fn(),
};

const mockDiscovery = {
  getBaseUrl: jest.fn(),
};

const mockIdentity = {
  getCredentials: jest.fn(),
  getBackstageIdentity: jest.fn(),
  getProfileInfo: jest.fn(),
  signOut: jest.fn(),
};

const mockOauthApi = {
  getAccessToken: jest.fn(),
  getIdToken: jest.fn(),
};

const originalCrypto = global.crypto;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'fetch').mockImplementation(mockFetch);
  Object.defineProperty(global, 'crypto', {
    value: { ...originalCrypto, randomUUID: () => 'test-uuid' },
    writable: true,
  });
  mockDiscovery.getBaseUrl.mockResolvedValue('http://localhost/api/permission');
  mockIdentity.getCredentials.mockResolvedValue({ token: 'backstage-token' });
  mockOauthApi.getAccessToken.mockResolvedValue('idp-token');
});

afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(global, 'crypto', {
    value: originalCrypto,
    writable: true,
  });
});

function createApi(
  opts: { permissionEnabled?: boolean; authEnabled?: boolean } = {},
) {
  mockConfig.getOptionalBoolean.mockImplementation((key: string) => {
    if (key === 'permission.enabled') return opts.permissionEnabled ?? true;
    if (key === 'openchoreo.features.auth.enabled')
      return opts.authEnabled ?? true;
    return undefined;
  });
  return new OpenChoreoPermissionApi({
    config: mockConfig,
    discovery: mockDiscovery,
    identity: mockIdentity,
    oauthApi: mockOauthApi,
  });
}

describe('OpenChoreoPermissionApi', () => {
  it('returns ALLOW when permissions are disabled', async () => {
    const api = createApi({ permissionEnabled: false });
    const result = await api.authorize({ permission: { name: 'test.read' } });

    expect(result).toEqual({ result: AuthorizeResult.ALLOW });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends POST to permission API with correct body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ items: [{ result: AuthorizeResult.ALLOW }] }),
    });
    const api = createApi();
    await api.authorize({ permission: { name: 'test.read' } });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost/api/permission/authorize',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          items: [{ id: 'test-uuid', permission: { name: 'test.read' } }],
        }),
      }),
    );
  });

  it('includes auth headers when auth is enabled', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ items: [{ result: AuthorizeResult.ALLOW }] }),
    });
    const api = createApi();
    await api.authorize({ permission: { name: 'test.read' } });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer backstage-token');
    expect(headers['x-openchoreo-token']).toBe('idp-token');
  });

  it('omits x-openchoreo-token when auth is disabled', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ items: [{ result: AuthorizeResult.ALLOW }] }),
    });
    const api = createApi({ authEnabled: false });
    await api.authorize({ permission: { name: 'test.read' } });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['x-openchoreo-token']).toBeUndefined();
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: 'Forbidden',
    });
    const api = createApi();

    await expect(
      api.authorize({ permission: { name: 'test.read' } }),
    ).rejects.toThrow('Permission request failed: Forbidden');
  });

  it('returns first item from response', async () => {
    const expected = { result: AuthorizeResult.DENY };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          items: [expected, { result: AuthorizeResult.ALLOW }],
        }),
    });
    const api = createApi();
    const result = await api.authorize({ permission: { name: 'test.read' } });

    expect(result).toEqual(expected);
  });
});
