import { OpenChoreoScopedFetchApi } from './openChoreoFetchApi';
import type { OpenChoreoTokenApi } from './openChoreoTokenApiRef';

const BACKEND = 'http://localhost:7007';
const OPENCHOREO_URL = `${BACKEND}/api/openchoreo/component`;

const baseFetch = jest.fn();
const baseFetchApi = { fetch: baseFetch };

const tokenApi: jest.Mocked<OpenChoreoTokenApi> = {
  getToken: jest.fn(),
  signIn: jest.fn(),
  sessionState$: jest.fn(),
};

function createApi(authEnabled = true) {
  return new OpenChoreoScopedFetchApi({
    baseFetchApi,
    tokenApi,
    authEnabled,
    backendBaseUrl: BACKEND,
  });
}

const headersOf = (call = 0): Headers =>
  new Headers(baseFetch.mock.calls[call][1].headers);
const initOf = (call = 0): RequestInit => baseFetch.mock.calls[call][1];

beforeEach(() => {
  jest.clearAllMocks();
  baseFetch.mockResolvedValue(new Response('ok'));
  tokenApi.getToken.mockResolvedValue('idp-token');
});

describe('OpenChoreoScopedFetchApi', () => {
  it('delegates to the host fetch API rather than global fetch', async () => {
    await createApi().fetch(OPENCHOREO_URL, { method: 'POST' });

    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch.mock.calls[0][0]).toBe(OPENCHOREO_URL);
    expect(initOf().method).toBe('POST');
  });

  it('sets x-openchoreo-token for backend-bound requests', async () => {
    await createApi().fetch(OPENCHOREO_URL);

    expect(headersOf().get('x-openchoreo-token')).toBe('idp-token');
    expect(headersOf().has('Authorization')).toBe(false);
  });

  it('resolves a relative URL against the backend and still attaches the token', async () => {
    await createApi().fetch('/api/openchoreo/component');

    expect(headersOf().get('x-openchoreo-token')).toBe('idp-token');
  });

  it('omits the token when authentication is disabled', async () => {
    await createApi(false).fetch(OPENCHOREO_URL);

    expect(tokenApi.getToken).not.toHaveBeenCalled();
    expect(headersOf().has('x-openchoreo-token')).toBe(false);
  });

  it('proceeds without the token when the session cannot be resolved', async () => {
    tokenApi.getToken.mockRejectedValue(new Error('no session'));

    await expect(createApi().fetch(OPENCHOREO_URL)).resolves.toBeDefined();
    expect(headersOf().has('x-openchoreo-token')).toBe(false);
  });

  // The API is exported, so a caller can pass any URL. Credentials must not
  // follow a mistaken destination.
  describe('destination restriction', () => {
    it('does not send the token to a third-party origin', async () => {
      await createApi().fetch('http://evil.example.com/collect');

      expect(tokenApi.getToken).not.toHaveBeenCalled();
      expect(headersOf().has('x-openchoreo-token')).toBe(false);
      expect(baseFetch).toHaveBeenCalledTimes(1);
    });

    it('does not send the token to another port on the same host', async () => {
      await createApi().fetch('http://localhost:9999/api/openchoreo/component');

      expect(headersOf().has('x-openchoreo-token')).toBe(false);
    });
  });

  describe('Request input', () => {
    it('preserves headers carried on a Request', async () => {
      const request = new Request(OPENCHOREO_URL, {
        headers: { 'Content-Type': 'application/json' },
      });

      await createApi().fetch(request);

      expect(headersOf().get('Content-Type')).toBe('application/json');
      expect(headersOf().get('x-openchoreo-token')).toBe('idp-token');
    });

    it('honours a direct-mode signal set on a Request', async () => {
      const request = new Request('http://agent.example.com', {
        headers: { 'x-openchoreo-direct': 'true' },
      });

      await createApi().fetch(request);

      expect(headersOf().get('Authorization')).toBe('Bearer idp-token');
      expect(headersOf().has('x-openchoreo-direct')).toBe(false);
      expect(initOf().credentials).toBe('include');
    });
  });

  describe('direct mode', () => {
    it('moves the token to Authorization, strips the signal header and includes credentials', async () => {
      await createApi().fetch('http://agent.example.com', {
        headers: { 'x-openchoreo-direct': 'true' },
      });

      expect(headersOf().get('Authorization')).toBe('Bearer idp-token');
      expect(headersOf().has('x-openchoreo-direct')).toBe(false);
      expect(headersOf().has('x-openchoreo-token')).toBe(false);
      expect(initOf().credentials).toBe('include');
    });

    it('throws when no token is available', async () => {
      tokenApi.getToken.mockResolvedValue(undefined);

      await expect(
        createApi().fetch('http://agent.example.com', {
          headers: { 'x-openchoreo-direct': 'true' },
        }),
      ).rejects.toThrow('token resolution returned an empty token');
      expect(baseFetch).not.toHaveBeenCalled();
    });

    it('keeps credentials and strips the signal header in guest mode', async () => {
      await createApi(false).fetch('http://agent.example.com', {
        headers: { 'x-openchoreo-direct': 'true' },
      });

      expect(headersOf().has('x-openchoreo-direct')).toBe(false);
      expect(headersOf().has('Authorization')).toBe(false);
      expect(initOf().credentials).toBe('include');
    });
  });
});
