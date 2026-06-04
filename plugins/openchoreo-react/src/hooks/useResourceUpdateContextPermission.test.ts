import { renderHook, waitFor } from '@testing-library/react';
import { useResourceUpdateContextPermission } from './useResourceUpdateContextPermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

const mockUseEntity = jest.fn();
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => mockUseEntity(),
}));

jest.mock('@backstage/catalog-model', () => ({
  stringifyEntityRef: () => 'resource:default/test',
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

// Stand-in for the imported permission + annotation constants. The hook only
// reads `permission.name`, so we don't need the full Permission type here.
jest.mock('@openchoreo/backstage-plugin-common', () => ({
  openchoreoResourceUpdatePermission: {
    type: 'resource',
    name: 'openchoreo.resource.update',
    attributes: { action: 'update' },
  },
  CHOREO_ANNOTATIONS: {
    RESOURCE_TYPE: 'openchoreo.io/resource-type',
    RESOURCE_TYPE_KIND: 'openchoreo.io/resource-type-kind',
  },
}));

interface MakeEntityArgs {
  resourceType?: string;
  resourceTypeKind?: string;
}

const makeEntity = (args: MakeEntityArgs = {}) => {
  const annotations: Record<string, string> = {};
  if (args.resourceType !== undefined) {
    annotations['openchoreo.io/resource-type'] = args.resourceType;
  }
  if (args.resourceTypeKind !== undefined) {
    annotations['openchoreo.io/resource-type-kind'] = args.resourceTypeKind;
  }
  return {
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Resource',
      metadata: { name: 'test', namespace: 'default', annotations },
    },
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBaseUrl.mockResolvedValue('http://localhost/api/permission');
  mockUseAuthzEnabled.mockReturnValue(true);
  // The annotation carries the bare ResourceType name, used verbatim.
  mockUseEntity.mockReturnValue(makeEntity({ resourceType: 'redis' }));
});

describe('useResourceUpdateContextPermission', () => {
  it('returns ALLOW when authz on, base allowed, backend allows', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    const { result } = renderHook(() => useResourceUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateResource).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      permissionName: 'openchoreo.resource.update',
      resourceRef: 'resource:default/test',
      resourceType: { name: 'redis', kind: undefined },
    });
  });

  it('returns DENY when authz on, base allowed, backend denies', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: false }),
    });

    const { result } = renderHook(() => useResourceUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateResource).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT fetch and propagates base allowed when authz disabled', async () => {
    mockUseAuthzEnabled.mockReturnValue(false);
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderHook(() => useResourceUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateResource).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('degrades to base (no fetch) when entity has no resourceType annotation', async () => {
    mockUseEntity.mockReturnValue(makeEntity());
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderHook(() => useResourceUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateResource).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('propagates base denied without firing the contextual call', async () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });

    const { result } = renderHook(() => useResourceUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateResource).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fails closed on network error', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useResourceUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateResource).toBe(false);
  });

  it('fails closed on non-ok HTTP response', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    const { result } = renderHook(() => useResourceUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateResource).toBe(false);
  });

  it('forwards resourceType.kind from the annotation to the backend', async () => {
    mockUseEntity.mockReturnValue(
      makeEntity({
        resourceType: 'redis',
        resourceTypeKind: 'ClusterResourceType',
      }),
    );
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    renderHook(() => useResourceUpdateContextPermission());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.resourceType).toEqual({
      name: 'redis',
      kind: 'ClusterResourceType',
    });
  });

  it('passes a slashed resourceType annotation through unchanged', async () => {
    mockUseEntity.mockReturnValue(makeEntity({ resourceType: 'group/redis' }));
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    renderHook(() => useResourceUpdateContextPermission());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.resourceType.name).toBe('group/redis');
  });

  it('reports loading while the base check is loading', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });

    const { result } = renderHook(() => useResourceUpdateContextPermission());

    expect(result.current.loading).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not reuse the previous entity allow result when the resourceType changes', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    // First entity's resourceType is allowed by the backend; a subsequent
    // entity is denied.
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ allowed: true }),
      })
      .mockResolvedValue({ ok: true, json: async () => ({ allowed: false }) });

    const { result, rerender } = renderHook(() =>
      useResourceUpdateContextPermission(),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateResource).toBe(true);

    // Switch to a different resource before the new evaluation resolves. The
    // stale allow from the first entity must not leak through: the hook reports
    // loading (not a settled allow) until the backend re-evaluates.
    mockUseEntity.mockReturnValue(makeEntity({ resourceType: 'postgres' }));
    rerender();

    expect(result.current.loading).toBe(true);
    expect(result.current.canUpdateResource).toBe(false);

    // Once the backend denies the new resourceType, the result settles to deny.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateResource).toBe(false);
  });
});
