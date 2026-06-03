import { renderHook, waitFor } from '@testing-library/react';
import { useResourceCreateContextPermission } from './useResourceCreateContextPermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

const mockGetBaseUrl = jest.fn();
const mockFetch = jest.fn();
// Stable API singletons — see useEnvScopedPermission.test.ts for why.
const mockDiscoveryApi = { getBaseUrl: mockGetBaseUrl };
const mockFetchApi = { fetch: mockFetch };
jest.mock('@backstage/core-plugin-api', () => {
  const discoveryRef = Symbol('discoveryApiRef');
  const fetchRef = Symbol('fetchApiRef');
  return {
    discoveryApiRef: discoveryRef,
    fetchApiRef: fetchRef,
    useApi: (apiRef: symbol) => {
      if (apiRef === discoveryRef) return mockDiscoveryApi;
      if (apiRef === fetchRef) return mockFetchApi;
      return {};
    },
  };
});

const mockUseAuthzEnabled = jest.fn();
jest.mock('./useOpenChoreoFeatures', () => ({
  useAuthzEnabled: () => mockUseAuthzEnabled(),
}));

// Stand-in for the imported permission constant. The hook only reads
// `permission.name`, so we don't need the full Permission type here.
jest.mock('@openchoreo/backstage-plugin-common', () => ({
  openchoreoResourceCreatePermission: {
    type: 'basic',
    name: 'openchoreo.resource.create',
    attributes: { action: 'create' },
  },
}));

interface RenderArgs {
  namespace?: string;
  project?: string;
  resourceType?: { name: string; kind?: string };
}

function renderCtxHook(args: RenderArgs) {
  return renderHook(() =>
    useResourceCreateContextPermission({
      namespace: args.namespace,
      project: args.project,
      resourceType: args.resourceType,
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBaseUrl.mockResolvedValue('http://localhost/api/permission');
  mockUseAuthzEnabled.mockReturnValue(true);
});

describe('useResourceCreateContextPermission', () => {
  it('returns ALLOW when authz on, base allowed, backend allows', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    const { result } = renderCtxHook({
      namespace: 'acme',
      project: 'payments',
      resourceType: { name: 'postgres' },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      permissionName: 'openchoreo.resource.create',
      namespace: 'acme',
      project: 'payments',
      resourceType: { name: 'postgres', kind: undefined },
    });
  });

  it('returns DENY when authz on, base allowed, backend denies', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: false }),
    });

    const { result } = renderCtxHook({
      namespace: 'acme',
      project: 'payments',
      resourceType: { name: 'redis' },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT fetch and propagates base allowed when authz disabled', async () => {
    mockUseAuthzEnabled.mockReturnValue(false);
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderCtxHook({
      namespace: 'acme',
      project: 'payments',
      resourceType: { name: 'postgres' },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('propagates base denied without firing the contextual call', async () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });

    const { result } = renderCtxHook({
      namespace: 'acme',
      project: 'payments',
      resourceType: { name: 'postgres' },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    {
      namespace: undefined,
      project: 'payments',
      resourceType: { name: 'postgres' },
    },
    {
      namespace: 'acme',
      project: undefined,
      resourceType: { name: 'postgres' },
    },
    { namespace: 'acme', project: 'payments', resourceType: undefined },
  ])(
    'skips the contextual call when context is incomplete (%p)',
    async args => {
      mockUsePermission.mockReturnValue({ allowed: true, loading: false });

      const { result } = renderCtxHook(args);

      await waitFor(() => expect(result.current.loading).toBe(false));
      // Without full context the hook degrades to base — base says allowed.
      expect(result.current.allowed).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it('fails closed on network error', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockRejectedValue(new Error('boom'));

    const { result } = renderCtxHook({
      namespace: 'acme',
      project: 'payments',
      resourceType: { name: 'postgres' },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
  });

  it('fails closed on non-ok HTTP response', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    const { result } = renderCtxHook({
      namespace: 'acme',
      project: 'payments',
      resourceType: { name: 'postgres' },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
  });

  it('forwards explicit resourceType.kind to the backend', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    renderCtxHook({
      namespace: 'acme',
      project: 'payments',
      resourceType: { name: 'postgres', kind: 'ClusterResourceType' },
    });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.resourceType).toEqual({
      name: 'postgres',
      kind: 'ClusterResourceType',
    });
  });
});
