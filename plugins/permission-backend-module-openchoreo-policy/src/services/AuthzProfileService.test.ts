import { mockServices } from '@backstage/backend-test-utils';
import { AuthzProfileService, getTtlFromToken } from './AuthzProfileService';
import type { UserCapabilitiesResponse } from './types';

// ---------------------------------------------------------------------------
// Mock the openchoreo-client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = mockServices.logger.mock();

const sampleCapabilities: UserCapabilitiesResponse = {
  capabilities: {
    'component:view': {
      allowed: [{ path: 'ns/acme' }],
      denied: [],
    },
  },
} as unknown as UserCapabilitiesResponse;

function createOkResponse<T>(data: T) {
  return {
    data,
    error: undefined,
    response: { ok: true as const, status: 200 },
  };
}

function createErrorResponse(status = 500, message = 'fail') {
  return {
    data: undefined,
    error: { message },
    response: {
      ok: false as const,
      status,
      statusText: 'Internal Server Error',
    },
  };
}

function createMockCache() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    getByUser: jest.fn(),
    setByUser: jest.fn(),
  };
}

function createService(cache?: ReturnType<typeof createMockCache>) {
  return new AuthzProfileService({
    baseUrl: 'http://test:8080',
    logger: mockLogger,
    cache: cache as any,
  });
}

/**
 * Build a minimal valid JWT token with the given `exp` claim (in seconds since epoch).
 */
function buildJwt(expSeconds: number): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'none', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString(
    'base64url',
  );
  return `${header}.${payload}.signature`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getTtlFromToken', () => {
  const DEFAULT_TTL_MS = 5 * 60 * 1000;

  it('returns default TTL when token is not a valid JWT', () => {
    expect(getTtlFromToken('not-a-jwt')).toBe(DEFAULT_TTL_MS);
  });

  it('returns default TTL when payload has no exp claim', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
      'base64url',
    );
    const payload = Buffer.from(JSON.stringify({})).toString('base64url');
    const token = `${header}.${payload}.sig`;
    expect(getTtlFromToken(token)).toBe(DEFAULT_TTL_MS);
  });

  it('derives TTL from exp claim in the future', () => {
    const exp = Math.floor(Date.now() / 1000) + 60; // 60s from now
    const token = buildJwt(exp);
    const ttl = getTtlFromToken(token);
    // Should be roughly 60s = 60000ms (allow wide slack)
    expect(ttl).toBeGreaterThan(30000);
    expect(ttl).toBeLessThanOrEqual(60000);
  });

  it('returns at least 1000ms for an expired token', () => {
    const exp = Math.floor(Date.now() / 1000) - 1000;
    const token = buildJwt(exp);
    expect(getTtlFromToken(token)).toBe(1000);
  });

  it('returns default TTL on malformed base64 payload', () => {
    const token = 'header.!!!not-base64!!!.sig';
    expect(getTtlFromToken(token)).toBe(DEFAULT_TTL_MS);
  });
});

describe('AuthzProfileService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCapabilities', () => {
    it('fetches from API when cache is not set', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(sampleCapabilities));
      const service = createService();

      const result = await service.getCapabilities('token-123', {
        namespace: 'acme',
      });

      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(mockGET).toHaveBeenCalledWith('/api/v1/authz/profile', {
        params: { query: { namespace: 'acme' } },
      });
      expect(result).toEqual(sampleCapabilities);
    });

    it('returns cached capabilities on cache hit (no API call)', async () => {
      const cache = createMockCache();
      cache.get.mockResolvedValueOnce(sampleCapabilities);
      const service = createService(cache);

      const result = await service.getCapabilities('token-123', {
        namespace: 'acme',
      });

      expect(cache.get).toHaveBeenCalledWith(
        'token-123',
        'acme',
        undefined,
        undefined,
      );
      expect(mockGET).not.toHaveBeenCalled();
      expect(result).toBe(sampleCapabilities);
    });

    it('caches the API response with TTL when cache is provided', async () => {
      const cache = createMockCache();
      cache.get.mockResolvedValueOnce(undefined); // cache miss
      mockGET.mockResolvedValueOnce(createOkResponse(sampleCapabilities));
      const service = createService(cache);

      await service.getCapabilities('token-123', {
        namespace: 'acme',
        project: 'foo',
      });

      expect(cache.set).toHaveBeenCalledTimes(1);
      const [token, cacheKey, value, ttlMs, project] = cache.set.mock.calls[0];
      expect(token).toBe('token-123');
      expect(cacheKey).toBe('acme');
      expect(value).toBe(sampleCapabilities);
      expect(typeof ttlMs).toBe('number');
      expect(ttlMs).toBeGreaterThan(0);
      expect(project).toBe('foo');
    });

    it('uses "global" as cache key when no namespace provided', async () => {
      const cache = createMockCache();
      cache.get.mockResolvedValueOnce(undefined);
      mockGET.mockResolvedValueOnce(createOkResponse(sampleCapabilities));
      const service = createService(cache);

      await service.getCapabilities('token-123');

      expect(cache.get).toHaveBeenCalledWith(
        'token-123',
        'global',
        undefined,
        undefined,
      );
    });

    it('passes project and component as query parameters', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(sampleCapabilities));
      const service = createService();

      await service.getCapabilities('token', {
        namespace: 'acme',
        project: 'foo',
        component: 'api',
      });

      expect(mockGET).toHaveBeenCalledWith('/api/v1/authz/profile', {
        params: {
          query: { namespace: 'acme', project: 'foo', component: 'api' },
        },
      });
    });

    it('throws when API returns an error', async () => {
      mockGET.mockResolvedValueOnce(createErrorResponse(500, 'internal'));
      const service = createService();

      await expect(
        service.getCapabilities('token', { namespace: 'acme' }),
      ).rejects.toThrow();
    });
  });

  describe('getCapabilitiesForUser', () => {
    it('returns cached capabilities by userEntityRef without API call', async () => {
      const cache = createMockCache();
      cache.getByUser.mockResolvedValueOnce(sampleCapabilities);
      const service = createService(cache);

      const result = await service.getCapabilitiesForUser('user:default/alice');

      expect(cache.getByUser).toHaveBeenCalledWith(
        'user:default/alice',
        'global',
      );
      expect(mockGET).not.toHaveBeenCalled();
      expect(result).toBe(sampleCapabilities);
    });

    it('returns empty capabilities (deny all) when no token and no cache hit', async () => {
      const cache = createMockCache();
      cache.getByUser.mockResolvedValueOnce(undefined);
      const service = createService(cache);

      const result = await service.getCapabilitiesForUser('user:default/alice');

      expect(result).toEqual({ capabilities: {} });
      expect(mockGET).not.toHaveBeenCalled();
    });

    it('fetches from API when token provided and no cache hit, then stores by userEntityRef', async () => {
      const cache = createMockCache();
      cache.getByUser.mockResolvedValueOnce(undefined);
      cache.get.mockResolvedValueOnce(undefined); // token-cache miss
      mockGET.mockResolvedValueOnce(createOkResponse(sampleCapabilities));
      const service = createService(cache);

      const result = await service.getCapabilitiesForUser(
        'user:default/alice',
        'token-abc',
        { namespace: 'acme' },
      );

      expect(mockGET).toHaveBeenCalledTimes(1);
      expect(cache.setByUser).toHaveBeenCalledTimes(1);
      const [userRef, caps, ttlMs, cacheKey] = cache.setByUser.mock.calls[0];
      expect(userRef).toBe('user:default/alice');
      expect(caps).toBe(sampleCapabilities);
      expect(typeof ttlMs).toBe('number');
      expect(cacheKey).toBe('acme');
      expect(result).toBe(sampleCapabilities);
    });

    it('returns empty capabilities when no cache is configured and no token provided', async () => {
      const service = createService(); // no cache

      const result = await service.getCapabilitiesForUser('user:default/alice');

      expect(result).toEqual({ capabilities: {} });
      expect(mockGET).not.toHaveBeenCalled();
    });
  });

  describe('preCacheCapabilities', () => {
    it('fetches from API bypassing token-hash cache and updates both caches', async () => {
      const cache = createMockCache();
      mockGET.mockResolvedValueOnce(createOkResponse(sampleCapabilities));
      const service = createService(cache);

      await service.preCacheCapabilities('user:default/alice', 'token-abc');

      // Should NOT check cache.get before fetching (always fresh)
      expect(cache.get).not.toHaveBeenCalled();
      expect(mockGET).toHaveBeenCalledTimes(1);

      // Should cache both by token and by userEntityRef
      expect(cache.set).toHaveBeenCalledTimes(1);
      const [token, key, caps] = cache.set.mock.calls[0];
      expect(token).toBe('token-abc');
      expect(key).toBe('global');
      expect(caps).toBe(sampleCapabilities);

      expect(cache.setByUser).toHaveBeenCalledTimes(1);
      const [userRef, userCaps, , userKey] = cache.setByUser.mock.calls[0];
      expect(userRef).toBe('user:default/alice');
      expect(userCaps).toBe(sampleCapabilities);
      expect(userKey).toBe('global');
    });

    it('still fetches when no cache is configured (no cache writes)', async () => {
      mockGET.mockResolvedValueOnce(createOkResponse(sampleCapabilities));
      const service = createService();

      await expect(
        service.preCacheCapabilities('user:default/alice', 'token'),
      ).resolves.toBeUndefined();

      expect(mockGET).toHaveBeenCalledTimes(1);
    });

    it('propagates errors from the API', async () => {
      const cache = createMockCache();
      mockGET.mockResolvedValueOnce(createErrorResponse(500));
      const service = createService(cache);

      await expect(
        service.preCacheCapabilities('user:default/alice', 'token'),
      ).rejects.toThrow();
      expect(cache.set).not.toHaveBeenCalled();
      expect(cache.setByUser).not.toHaveBeenCalled();
    });
  });
});
