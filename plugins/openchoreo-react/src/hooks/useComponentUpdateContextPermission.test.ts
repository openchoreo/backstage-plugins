import { renderHook, waitFor } from '@testing-library/react';
import { useComponentUpdateContextPermission } from './useComponentUpdateContextPermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

const mockUseEntity = jest.fn();
jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => mockUseEntity(),
}));

jest.mock('@backstage/catalog-model', () => ({
  stringifyEntityRef: () => 'component:default/test',
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
  openchoreoComponentUpdatePermission: {
    type: 'resource',
    name: 'openchoreo.component.update',
    attributes: { action: 'update' },
  },
  CHOREO_ANNOTATIONS: {
    COMPONENT_TYPE: 'openchoreo.io/component-type',
    COMPONENT_TYPE_KIND: 'openchoreo.io/component-type-kind',
  },
}));

interface MakeEntityArgs {
  componentType?: string;
  componentTypeKind?: string;
}

const makeEntity = (args: MakeEntityArgs = {}) => {
  const annotations: Record<string, string> = {};
  if (args.componentType !== undefined) {
    annotations['openchoreo.io/component-type'] = args.componentType;
  }
  if (args.componentTypeKind !== undefined) {
    annotations['openchoreo.io/component-type-kind'] = args.componentTypeKind;
  }
  return {
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'test', namespace: 'default', annotations },
    },
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBaseUrl.mockResolvedValue('http://localhost/api/permission');
  mockUseAuthzEnabled.mockReturnValue(true);
  // Default carries the real `workloadType/name` composite the catalog stamps
  // on the annotation; the hook strips it to the bare ComponentType name.
  mockUseEntity.mockReturnValue(
    makeEntity({ componentType: 'deployment/service' }),
  );
});

describe('useComponentUpdateContextPermission', () => {
  it('returns ALLOW when authz on, base allowed, backend allows', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    const { result } = renderHook(() => useComponentUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateComponent).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      permissionName: 'openchoreo.component.update',
      resourceRef: 'component:default/test',
      componentType: { name: 'service', kind: undefined },
    });
  });

  it('returns DENY when authz on, base allowed, backend denies', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: false }),
    });

    const { result } = renderHook(() => useComponentUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateComponent).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT fetch and propagates base allowed when authz disabled', async () => {
    mockUseAuthzEnabled.mockReturnValue(false);
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderHook(() => useComponentUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateComponent).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('degrades to base (no fetch) when entity has no componentType annotation', async () => {
    mockUseEntity.mockReturnValue(makeEntity());
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderHook(() => useComponentUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateComponent).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('propagates base denied without firing the contextual call', async () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });

    const { result } = renderHook(() => useComponentUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateComponent).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fails closed on network error', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useComponentUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateComponent).toBe(false);
  });

  it('fails closed on non-ok HTTP response', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    const { result } = renderHook(() => useComponentUpdateContextPermission());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canUpdateComponent).toBe(false);
  });

  it('forwards componentType.kind from the annotation to the backend', async () => {
    mockUseEntity.mockReturnValue(
      makeEntity({
        componentType: 'deployment/service',
        componentTypeKind: 'ClusterComponentType',
      }),
    );
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    renderHook(() => useComponentUpdateContextPermission());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.componentType).toEqual({
      name: 'service',
      kind: 'ClusterComponentType',
    });
  });

  it('strips the workloadType/ prefix to the bare ComponentType name', async () => {
    mockUseEntity.mockReturnValue(
      makeEntity({ componentType: 'cronjob/scheduled-task' }),
    );
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    renderHook(() => useComponentUpdateContextPermission());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.componentType.name).toBe('scheduled-task');
  });

  it('passes a prefix-less componentType annotation through unchanged', async () => {
    mockUseEntity.mockReturnValue(makeEntity({ componentType: 'service' }));
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    renderHook(() => useComponentUpdateContextPermission());

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.componentType.name).toBe('service');
  });

  it('reports loading while the base check is loading', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });

    const { result } = renderHook(() => useComponentUpdateContextPermission());

    expect(result.current.loading).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
