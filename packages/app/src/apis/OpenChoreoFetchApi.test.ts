import { OpenChoreoFetchApi } from './OpenChoreoFetchApi';

const mockIdentityApi = {
  getCredentials: jest.fn(),
  getBackstageIdentity: jest.fn(),
  getProfileInfo: jest.fn(),
  signOut: jest.fn(),
};

const mockOauthApi = {
  getAccessToken: jest.fn(),
  getIdToken: jest.fn(),
};

const mockConfigApi = {
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

const mockFetch = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'fetch').mockImplementation(mockFetch);
  mockFetch.mockResolvedValue(new Response('ok'));
  mockConfigApi.getOptionalBoolean.mockReturnValue(true);
  mockIdentityApi.getCredentials.mockResolvedValue({
    token: 'backstage-token',
  });
  mockOauthApi.getAccessToken.mockResolvedValue('idp-token');
});

afterEach(() => {
  jest.restoreAllMocks();
});

function createApi(authEnabled = true) {
  mockConfigApi.getOptionalBoolean.mockReturnValue(authEnabled);
  return new OpenChoreoFetchApi(mockIdentityApi, mockOauthApi, mockConfigApi);
}

describe('OpenChoreoFetchApi', () => {
  describe('normal mode', () => {
    it('sets Authorization header with Backstage token', async () => {
      const api = createApi();
      await api.fetch('http://example.com');

      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer backstage-token');
    });

    it('sets x-openchoreo-token header with IDP token', async () => {
      const api = createApi();
      await api.fetch('http://example.com');

      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get('x-openchoreo-token')).toBe('idp-token');
    });

    it('skips IDP token when auth is disabled', async () => {
      const api = createApi(false);
      await api.fetch('http://example.com');

      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get('x-openchoreo-token')).toBeNull();
      expect(headers.get('Authorization')).toBe('Bearer backstage-token');
    });

    it('continues without IDP token when oauthApi throws', async () => {
      mockOauthApi.getAccessToken.mockRejectedValue(new Error('no token'));
      const api = createApi();
      await api.fetch('http://example.com');

      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get('x-openchoreo-token')).toBeNull();
      expect(headers.get('Authorization')).toBe('Bearer backstage-token');
    });
  });

  describe('direct mode', () => {
    it('strips x-openchoreo-direct header and sets IDP token in Authorization', async () => {
      const api = createApi();
      await api.fetch('http://example.com', {
        headers: { 'x-openchoreo-direct': 'true' },
      });

      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.has('x-openchoreo-direct')).toBe(false);
      expect(headers.get('Authorization')).toBe('Bearer idp-token');
    });

    it('does not set Backstage token in direct mode', async () => {
      const api = createApi();
      await api.fetch('http://example.com', {
        headers: { 'x-openchoreo-direct': 'true' },
      });

      // In direct mode, Authorization should be IDP token, not Backstage token
      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer idp-token');
      expect(mockIdentityApi.getCredentials).not.toHaveBeenCalled();
    });

    it('skips IDP token when auth is disabled in direct mode', async () => {
      const api = createApi(false);
      await api.fetch('http://example.com', {
        headers: { 'x-openchoreo-direct': 'true' },
      });

      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get('Authorization')).toBeNull();
    });
  });
});
