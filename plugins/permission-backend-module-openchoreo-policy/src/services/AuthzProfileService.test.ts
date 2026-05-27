import { mockServices } from '@backstage/backend-test-utils';
import { AuthzProfileService, getTtlFromToken } from './AuthzProfileService';
import type { UserCapabilitiesResponse } from './types';

// ---------------------------------------------------------------------------
// Mock the openchoreo-client-node module
// ---------------------------------------------------------------------------

const mockGET = jest.fn();
const mockPOST = jest.fn();

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(() => ({
    GET: mockGET,
    POST: mockPOST,
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
    getEvaluation: jest.fn(),
    setEvaluation: jest.fn(),
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

  // The CEL attribute `resource.environment` is matched against the same
  // encoding the OpenChoreo Go service layer uses
  // (`FormatDualScopedResourceName`). For namespaced resources that is
  // `{namespace}/{name}`; for cluster-scoped resources it is the bare
  // `{name}`. Real-world `AuthzRoleBinding` conditions are authored in
  // this format, so getting the wire value wrong silently bypasses the
  // ABAC condition.
  describe('evaluate — environment encoding', () => {
    const subjectProfile = {
      user: {
        type: 'user',
        entitlement_claim: 'groups',
        entitlement_values: ['developers'],
      },
      capabilities: {},
    } as unknown as UserCapabilitiesResponse;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('encodes env as `{namespace}/{name}` for namespace-scoped resource paths', async () => {
      const cache = createMockCache();
      // Subject context is read from the cached profile by evaluate().
      cache.getByUser.mockResolvedValue(subjectProfile);
      cache.getEvaluation.mockResolvedValue(undefined); // force backend call
      mockPOST.mockResolvedValue(createOkResponse([{ decision: false }]));

      const service = createService(cache);
      const exp = Math.floor(Date.now() / 1000) + 3600;

      const result = await service.evaluate(
        buildJwt(exp),
        'user:default/alice',
        [
          {
            action: 'releasebinding:update',
            resourcePath:
              'ns/team-shop/project/team-shop/component/snip-api-service',
            environment: 'production',
          },
        ],
      );

      expect(result).toEqual([false]);
      expect(mockPOST).toHaveBeenCalledTimes(1);
      const body = mockPOST.mock.calls[0][1].body;
      expect(body[0].context).toEqual({
        resource: { environment: 'team-shop/production' },
      });
      // Cache write must use the encoded form so two namespaces sharing
      // the same env name do not collide. The second positional argument is
      // a token-derived hash so the cache key invalidates when the user
      // signs out and back in (see token-scoped test below).
      expect(cache.setEvaluation).toHaveBeenCalledWith(
        'user:default/alice',
        expect.any(String),
        'releasebinding:update',
        'ns/team-shop/project/team-shop/component/snip-api-service',
        'team-shop/production',
        undefined, // no workflow on this input
        false,
        expect.any(Number),
      );
    });

    it('binds the cache key to the user token so re-login forces re-evaluation', async () => {
      const cache = createMockCache();
      cache.getByUser.mockResolvedValue(subjectProfile);
      cache.getEvaluation.mockResolvedValue(undefined);
      mockPOST.mockResolvedValue(createOkResponse([{ decision: false }]));

      const service = createService(cache);
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const firstToken = buildJwt(exp);
      // Different payload (e.g. fresh `iat` after re-login) → different JWT
      // string → different hash. We only need the hash to differ.
      const secondToken = `${firstToken}-second-session`;

      const input = {
        action: 'releasebinding:view',
        resourcePath:
          'ns/team-shop/project/team-shop/component/snip-api-service',
        environment: 'development',
      };

      await service.evaluate(firstToken, 'user:default/alice', [input]);
      await service.evaluate(secondToken, 'user:default/alice', [input]);

      // Both calls should have looked up the cache with the *same*
      // userEntityRef / action / resourcePath / encoded-env tuple, but with
      // *different* token-hash components. That difference is what allows the
      // second sign-in to bypass a stale `false` from the first session.
      expect(cache.getEvaluation).toHaveBeenCalledTimes(2);
      const firstHash = cache.getEvaluation.mock.calls[0][1];
      const secondHash = cache.getEvaluation.mock.calls[1][1];
      expect(firstHash).toEqual(expect.any(String));
      expect(secondHash).toEqual(expect.any(String));
      expect(firstHash).not.toEqual(secondHash);
      // And the backend was hit twice — the second call did not piggy-back
      // on the first session's cached decision.
      expect(mockPOST).toHaveBeenCalledTimes(2);
    });

    it('passes env through as bare `{name}` when no namespace is in the resource path', async () => {
      const cache = createMockCache();
      cache.getByUser.mockResolvedValue(subjectProfile);
      cache.getEvaluation.mockResolvedValue(undefined);
      mockPOST.mockResolvedValue(createOkResponse([{ decision: true }]));

      const service = createService(cache);
      const exp = Math.floor(Date.now() / 1000) + 3600;

      // No namespace in the resourcePath (cluster-wide wildcard "*"). The
      // helper falls back to bare `{name}`, matching the upstream observer
      // helper behavior — and the future cluster-scoped Environment case.
      await service.evaluate(buildJwt(exp), 'user:default/alice', [
        {
          action: 'releasebinding:update',
          resourcePath: '*',
          environment: 'production',
        },
      ]);

      const body = mockPOST.mock.calls[0][1].body;
      expect(body[0].context).toEqual({
        resource: { environment: 'production' },
      });
    });

    it('omits the context.resource.environment when no environment is supplied', async () => {
      const cache = createMockCache();
      cache.getByUser.mockResolvedValue(subjectProfile);
      cache.getEvaluation.mockResolvedValue(undefined);
      mockPOST.mockResolvedValue(createOkResponse([{ decision: true }]));

      const service = createService(cache);
      const exp = Math.floor(Date.now() / 1000) + 3600;

      await service.evaluate(buildJwt(exp), 'user:default/alice', [
        {
          action: 'releasebinding:view',
          resourcePath: 'ns/team-shop',
        },
      ]);

      const body = mockPOST.mock.calls[0][1].body;
      expect(body[0].context).toBeUndefined();
    });
  });

  describe('evaluate — workflow encoding', () => {
    const subjectProfile = {
      user: {
        type: 'user',
        entitlement_claim: 'groups',
        entitlement_values: ['developers'],
      },
      capabilities: {},
    } as unknown as UserCapabilitiesResponse;

    const NS_PATH = 'ns/team-shop/project/team-shop/component/snip-api-service';

    beforeEach(() => {
      jest.clearAllMocks();
    });

    function setupService() {
      const cache = createMockCache();
      cache.getByUser.mockResolvedValue(subjectProfile);
      cache.getEvaluation.mockResolvedValue(undefined);
      mockPOST.mockResolvedValue(createOkResponse([{ decision: true }]));
      return { cache, service: createService(cache) };
    }

    it('encodes workflow as `{namespace}/{name}` for a namespace-scoped Workflow', async () => {
      const { service } = setupService();
      const exp = Math.floor(Date.now() / 1000) + 3600;

      await service.evaluate(buildJwt(exp), 'user:default/alice', [
        {
          action: 'workflowrun:create',
          resourcePath: NS_PATH,
          workflow: { name: 'build-go', kind: 'Workflow' },
        },
      ]);

      const body = mockPOST.mock.calls[0][1].body;
      expect(body[0].context).toEqual({
        resource: { workflow: 'team-shop/build-go' },
      });
    });

    it('encodes workflow as `{namespace}/{name}` for a ComponentWorkflow', async () => {
      const { service } = setupService();
      const exp = Math.floor(Date.now() / 1000) + 3600;

      await service.evaluate(buildJwt(exp), 'user:default/alice', [
        {
          action: 'workflowrun:create',
          resourcePath: NS_PATH,
          workflow: { name: 'build-go', kind: 'ComponentWorkflow' },
        },
      ]);

      const body = mockPOST.mock.calls[0][1].body;
      expect(body[0].context).toEqual({
        resource: { workflow: 'team-shop/build-go' },
      });
    });

    it('encodes workflow as the bare `{name}` for a cluster-scoped ClusterWorkflow', async () => {
      const { service } = setupService();
      const exp = Math.floor(Date.now() / 1000) + 3600;

      await service.evaluate(buildJwt(exp), 'user:default/alice', [
        {
          action: 'workflowrun:create',
          resourcePath: NS_PATH,
          // Even though the resource path is namespaced, a ClusterWorkflow is
          // globally unique by name, so no namespace prefix is added.
          workflow: { name: 'build-go', kind: 'ClusterWorkflow' },
        },
      ]);

      const body = mockPOST.mock.calls[0][1].body;
      expect(body[0].context).toEqual({
        resource: { workflow: 'build-go' },
      });
    });

    it('treats an unknown/absent kind as namespace-scoped', async () => {
      const { service } = setupService();
      const exp = Math.floor(Date.now() / 1000) + 3600;

      await service.evaluate(buildJwt(exp), 'user:default/alice', [
        {
          action: 'workflowrun:create',
          resourcePath: NS_PATH,
          workflow: { name: 'build-go' }, // no kind
        },
      ]);

      const body = mockPOST.mock.calls[0][1].body;
      expect(body[0].context).toEqual({
        resource: { workflow: 'team-shop/build-go' },
      });
    });

    it('sends both environment and workflow when both are supplied', async () => {
      const { service } = setupService();
      const exp = Math.floor(Date.now() / 1000) + 3600;

      await service.evaluate(buildJwt(exp), 'user:default/alice', [
        {
          action: 'workflowrun:create',
          resourcePath: NS_PATH,
          environment: 'production',
          workflow: { name: 'build-go', kind: 'Workflow' },
        },
      ]);

      const body = mockPOST.mock.calls[0][1].body;
      expect(body[0].context).toEqual({
        resource: {
          environment: 'team-shop/production',
          workflow: 'team-shop/build-go',
        },
      });
    });

    it('caches the decision under the encoded workflow value', async () => {
      const { cache, service } = setupService();
      const exp = Math.floor(Date.now() / 1000) + 3600;

      await service.evaluate(buildJwt(exp), 'user:default/alice', [
        {
          action: 'workflowrun:create',
          resourcePath: NS_PATH,
          workflow: { name: 'build-go', kind: 'Workflow' },
        },
      ]);

      expect(cache.setEvaluation).toHaveBeenCalledWith(
        'user:default/alice',
        expect.any(String),
        'workflowrun:create',
        NS_PATH,
        undefined, // no environment on this input
        'team-shop/build-go', // encoded workflow
        true,
        expect.any(Number),
      );
    });

    it('omits context entirely when neither environment nor workflow is supplied', async () => {
      const { service } = setupService();
      const exp = Math.floor(Date.now() / 1000) + 3600;

      await service.evaluate(buildJwt(exp), 'user:default/alice', [
        { action: 'workflowrun:create', resourcePath: NS_PATH },
      ]);

      const body = mockPOST.mock.calls[0][1].body;
      expect(body[0].context).toBeUndefined();
    });
  });
});
