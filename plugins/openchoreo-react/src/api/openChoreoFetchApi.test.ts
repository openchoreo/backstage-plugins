import { OpenChoreoScopedFetchApi } from './openChoreoFetchApi';
import type { OpenChoreoTokenApi } from './openChoreoTokenApiRef';

const baseFetch = jest.fn();
const baseFetchApi = { fetch: baseFetch };

const tokenApi: jest.Mocked<OpenChoreoTokenApi> = {
  getToken: jest.fn(),
  signIn: jest.fn(),
  sessionState$: jest.fn(),
};

function headersOf(call: number = 0): Headers {
  return new Headers(baseFetch.mock.calls[call][1].headers);
}

beforeEach(() => {
  jest.clearAllMocks();
  baseFetch.mockResolvedValue(new Response('ok'));
  tokenApi.getToken.mockResolvedValue('idp-token');
});

describe('OpenChoreoScopedFetchApi', () => {
  it('delegates to the host fetch API rather than global fetch', async () => {
    const api = new OpenChoreoScopedFetchApi(baseFetchApi, tokenApi, true);

    await api.fetch('http://example.com/x', { method: 'POST' });

    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch.mock.calls[0][0]).toBe('http://example.com/x');
    expect(baseFetch.mock.calls[0][1].method).toBe('POST');
  });

  it('sets x-openchoreo-token in normal mode', async () => {
    const api = new OpenChoreoScopedFetchApi(baseFetchApi, tokenApi, true);

    await api.fetch('http://example.com');

    expect(headersOf().get('x-openchoreo-token')).toBe('idp-token');
    expect(headersOf().has('Authorization')).toBe(false);
  });

  it('omits the token when authentication is disabled', async () => {
    const api = new OpenChoreoScopedFetchApi(baseFetchApi, tokenApi, false);

    await api.fetch('http://example.com');

    expect(tokenApi.getToken).not.toHaveBeenCalled();
    expect(headersOf().has('x-openchoreo-token')).toBe(false);
  });

  it('proceeds without the token when the session cannot be resolved', async () => {
    tokenApi.getToken.mockRejectedValue(new Error('no session'));
    const api = new OpenChoreoScopedFetchApi(baseFetchApi, tokenApi, true);

    await expect(api.fetch('http://example.com')).resolves.toBeDefined();
    expect(headersOf().has('x-openchoreo-token')).toBe(false);
  });

  describe('direct mode', () => {
    it('moves the token to Authorization, strips the signal header and includes credentials', async () => {
      const api = new OpenChoreoScopedFetchApi(baseFetchApi, tokenApi, true);

      await api.fetch('http://agent.example.com', {
        headers: { 'x-openchoreo-direct': 'true' },
      });

      expect(headersOf().get('Authorization')).toBe('Bearer idp-token');
      expect(headersOf().has('x-openchoreo-direct')).toBe(false);
      expect(headersOf().has('x-openchoreo-token')).toBe(false);
      expect(baseFetch.mock.calls[0][1].credentials).toBe('include');
    });

    it('throws when no token is available', async () => {
      tokenApi.getToken.mockResolvedValue(undefined);
      const api = new OpenChoreoScopedFetchApi(baseFetchApi, tokenApi, true);

      await expect(
        api.fetch('http://agent.example.com', {
          headers: { 'x-openchoreo-direct': 'true' },
        }),
      ).rejects.toThrow('token resolution returned an empty token');
      expect(baseFetch).not.toHaveBeenCalled();
    });

    it('still strips the signal header when authentication is disabled', async () => {
      const api = new OpenChoreoScopedFetchApi(baseFetchApi, tokenApi, false);

      await api.fetch('http://agent.example.com', {
        headers: { 'x-openchoreo-direct': 'true' },
      });

      expect(headersOf().has('x-openchoreo-direct')).toBe(false);
      expect(headersOf().has('Authorization')).toBe(false);
    });
  });
});
