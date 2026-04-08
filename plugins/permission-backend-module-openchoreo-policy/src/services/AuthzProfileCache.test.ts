import crypto from 'crypto';
import { AuthzProfileCache } from './AuthzProfileCache';
import type { UserCapabilitiesResponse } from './types';

/**
 * Creates a minimal mocked CacheService for unit tests.
 */
function createMockCache() {
  const cache = {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    withOptions: jest.fn(),
  };
  // withOptions returns the same cache (sufficient for tests)
  cache.withOptions.mockReturnValue(cache);
  return cache;
}

const sampleCapabilities: UserCapabilitiesResponse = {
  capabilities: {
    'component:view': {
      allowed: [{ path: 'ns/acme' }],
      denied: [],
    },
  },
} as unknown as UserCapabilitiesResponse;

function tokenHash(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
    .substring(0, 16);
}

describe('AuthzProfileCache', () => {
  let mockCache: ReturnType<typeof createMockCache>;
  let authzCache: AuthzProfileCache;

  beforeEach(() => {
    mockCache = createMockCache();
    authzCache = new AuthzProfileCache(mockCache as any);
  });

  describe('get', () => {
    it('calls cache.get with a key containing 16-char sha256 token hash', async () => {
      mockCache.get.mockResolvedValueOnce(sampleCapabilities);
      const result = await authzCache.get('my-token', 'acme');

      expect(mockCache.get).toHaveBeenCalledTimes(1);
      const key = mockCache.get.mock.calls[0][0] as string;
      expect(key).toContain(tokenHash('my-token'));
      expect(key).toContain('acme');
      expect(key).toMatch(/^openchoreo:capabilities:[a-f0-9]{16}:acme$/);
      expect(result).toBe(sampleCapabilities);
    });

    it('includes project and component segments in the cache key', async () => {
      mockCache.get.mockResolvedValueOnce(undefined);
      await authzCache.get('tok', 'acme', 'foo', 'api');

      const key = mockCache.get.mock.calls[0][0] as string;
      expect(key).toBe(
        `openchoreo:capabilities:${tokenHash('tok')}:acme:foo:api`,
      );
    });

    it('returns undefined on cache miss', async () => {
      mockCache.get.mockResolvedValueOnce(undefined);
      const result = await authzCache.get('tok', 'acme');
      expect(result).toBeUndefined();
    });

    it('does NOT store the raw token in the cache key', async () => {
      await authzCache.get('super-secret-token-value', 'acme');
      const key = mockCache.get.mock.calls[0][0] as string;
      expect(key).not.toContain('super-secret-token-value');
    });
  });

  describe('set', () => {
    it('calls cache.set with TTL option', async () => {
      await authzCache.set('tok', 'acme', sampleCapabilities, 60000);
      expect(mockCache.set).toHaveBeenCalledTimes(1);
      const [key, value, opts] = mockCache.set.mock.calls[0];
      expect(key).toContain(tokenHash('tok'));
      expect(value).toBe(sampleCapabilities);
      expect(opts).toEqual({ ttl: 60000 });
    });

    it('includes optional project/component in key when provided', async () => {
      await authzCache.set(
        'tok',
        'acme',
        sampleCapabilities,
        1000,
        'foo',
        'api',
      );
      const key = mockCache.set.mock.calls[0][0] as string;
      expect(key).toBe(
        `openchoreo:capabilities:${tokenHash('tok')}:acme:foo:api`,
      );
    });
  });

  describe('delete', () => {
    it('calls cache.delete with the same key used for get/set', async () => {
      await authzCache.delete('tok', 'acme');
      expect(mockCache.delete).toHaveBeenCalledTimes(1);
      const key = mockCache.delete.mock.calls[0][0] as string;
      expect(key).toBe(`openchoreo:capabilities:${tokenHash('tok')}:acme`);
    });

    it('builds matching key when project/component provided', async () => {
      await authzCache.delete('tok', 'acme', 'foo', 'api');
      const key = mockCache.delete.mock.calls[0][0] as string;
      expect(key).toBe(
        `openchoreo:capabilities:${tokenHash('tok')}:acme:foo:api`,
      );
    });
  });

  describe('key determinism', () => {
    it('produces the same key for the same token', async () => {
      await authzCache.get('identical-token', 'acme');
      await authzCache.get('identical-token', 'acme');
      const firstKey = mockCache.get.mock.calls[0][0] as string;
      const secondKey = mockCache.get.mock.calls[1][0] as string;
      expect(firstKey).toBe(secondKey);
    });

    it('produces different keys for different tokens', async () => {
      await authzCache.get('token-a', 'acme');
      await authzCache.get('token-b', 'acme');
      const keyA = mockCache.get.mock.calls[0][0] as string;
      const keyB = mockCache.get.mock.calls[1][0] as string;
      expect(keyA).not.toBe(keyB);
    });

    it('produces different keys for different orgs', async () => {
      await authzCache.get('tok', 'acme');
      await authzCache.get('tok', 'other');
      const keyA = mockCache.get.mock.calls[0][0] as string;
      const keyB = mockCache.get.mock.calls[1][0] as string;
      expect(keyA).not.toBe(keyB);
    });
  });

  describe('getByUser / setByUser', () => {
    it('getByUser uses a user-based key without token hash', async () => {
      mockCache.get.mockResolvedValueOnce(sampleCapabilities);
      const result = await authzCache.getByUser('user:default/alice');

      expect(mockCache.get).toHaveBeenCalledTimes(1);
      const key = mockCache.get.mock.calls[0][0] as string;
      expect(key).toBe('openchoreo:capabilities:user:user:default/alice');
      expect(result).toBe(sampleCapabilities);
    });

    it('getByUser includes org in key when provided', async () => {
      await authzCache.getByUser('user:default/alice', 'acme');
      const key = mockCache.get.mock.calls[0][0] as string;
      expect(key).toBe('openchoreo:capabilities:user:user:default/alice:acme');
    });

    it('setByUser calls cache.set with TTL option', async () => {
      await authzCache.setByUser(
        'user:default/alice',
        sampleCapabilities,
        30000,
        'acme',
      );

      expect(mockCache.set).toHaveBeenCalledTimes(1);
      const [key, value, opts] = mockCache.set.mock.calls[0];
      expect(key).toBe('openchoreo:capabilities:user:user:default/alice:acme');
      expect(value).toBe(sampleCapabilities);
      expect(opts).toEqual({ ttl: 30000 });
    });

    it('setByUser without org produces a shorter key', async () => {
      await authzCache.setByUser(
        'user:default/alice',
        sampleCapabilities,
        1000,
      );
      const key = mockCache.set.mock.calls[0][0] as string;
      expect(key).toBe('openchoreo:capabilities:user:user:default/alice');
    });

    it('user-based key is deterministic for the same userEntityRef', async () => {
      await authzCache.getByUser('user:default/alice', 'acme');
      await authzCache.getByUser('user:default/alice', 'acme');
      expect(mockCache.get.mock.calls[0][0]).toBe(
        mockCache.get.mock.calls[1][0],
      );
    });
  });
});
