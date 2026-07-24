import { ClientCredentialsProvider } from './ClientCredentialsProvider';
import { OpenChoreoAuthConfig } from './types';

const authConfig: OpenChoreoAuthConfig = {
  clientId: 'test-client',
  clientSecret: 'test-secret',
  tokenUrl: 'http://idp.test/oauth2/token',
  scopes: [],
};

function mkLogger() {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn().mockReturnThis(),
  } as any;
}

// `access_token` is intentionally not a real JWT; decodeJwt throws and the
// provider falls back to `expires_in`, which is all these tests need.
const okResponse = () => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => ({ access_token: 'access-token', expires_in: 3600 }),
  text: async () => '',
});

const errorResponse = (status: number) => ({
  ok: false,
  status,
  statusText: 'Error',
  json: async () => ({}),
  text: async () => 'error body',
});

describe('ClientCredentialsProvider', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  function mockFetch(...outcomes: Array<object | Error>) {
    const fn = jest.fn();
    for (const outcome of outcomes) {
      if (outcome instanceof Error) {
        fn.mockRejectedValueOnce(outcome);
      } else {
        fn.mockResolvedValueOnce(outcome);
      }
    }
    global.fetch = fn as any;
    return fn;
  }

  it('returns the token on first success without retrying', async () => {
    const fetchMock = mockFetch(okResponse());
    const provider = new ClientCredentialsProvider(authConfig, mkLogger());

    await expect(provider.getToken()).resolves.toBe('access-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a network error and then succeeds', async () => {
    jest.useFakeTimers();
    const fetchMock = mockFetch(new Error('fetch failed'), okResponse());
    const provider = new ClientCredentialsProvider(authConfig, mkLogger());

    const tokenPromise = provider.getToken();
    await jest.advanceTimersByTimeAsync(1000); // first backoff
    await expect(tokenPromise).resolves.toBe('access-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 4xx response', async () => {
    const fetchMock = mockFetch(errorResponse(401));
    const provider = new ClientCredentialsProvider(authConfig, mkLogger());

    await expect(provider.getToken()).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 5xx response up to the max attempts, then throws', async () => {
    jest.useFakeTimers();
    const fetchMock = mockFetch(
      errorResponse(503),
      errorResponse(503),
      errorResponse(503),
    );
    const provider = new ClientCredentialsProvider(authConfig, mkLogger());

    const tokenPromise = provider.getToken();
    tokenPromise.catch(() => {}); // avoid unhandled rejection while timers advance
    await jest.advanceTimersByTimeAsync(1000 + 2000); // both backoffs
    await expect(tokenPromise).rejects.toThrow(/503/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
