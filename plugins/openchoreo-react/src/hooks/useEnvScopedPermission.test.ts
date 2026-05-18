import { renderHook, waitFor } from '@testing-library/react';
import { useEnvScopedPermission } from './useEnvScopedPermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

const mockGetBaseUrl = jest.fn();
const mockFetch = jest.fn();
// Stable API singletons so useApi returns the same reference each render —
// otherwise the env-eval useEffect (which has `discovery` and `fetchApi` in
// its dep array) re-runs on every render and spirals into an infinite loop.
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

// Minimal Permission stand-in. Avoids depending on
// @backstage/plugin-permission-common in this package's devDeps; the hook
// only reads `permission.name` and a couple of type-narrowing properties.
const basicPermission = {
  type: 'basic' as const,
  name: 'openchoreo.releasebinding.view',
  attributes: { action: 'read' as const },
};

function renderEnvHook(environment: string | undefined) {
  return renderHook(() =>
    useEnvScopedPermission({
      permission: basicPermission,
      resourceRef: 'component:team-shop/snip-api-service',
      environment,
    }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBaseUrl.mockResolvedValue('http://localhost/api/permission');
  mockUseAuthzEnabled.mockReturnValue(true);
});

describe('useEnvScopedPermission', () => {
  it('returns env-eval ALLOW when authz on, base allowed, backend allows', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    const { result } = renderEnvHook('development');

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns env-eval DENY when authz on, base allowed, backend denies', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: false }),
    });

    const { result } = renderEnvHook('production');

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Regression test for the bug fixed alongside this test file: when
  // openchoreo.features.authz.enabled = false the policy backend installs
  // AllowAllPolicy and does NOT mount /evaluate-with-context. Firing the
  // fetch would 404 and fail closed to "denied" on every env tile.
  it('does NOT fetch /evaluate-with-context and propagates baseCheck.allowed when authz disabled', async () => {
    mockUseAuthzEnabled.mockReturnValue(false);
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderEnvHook('development');

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('still propagates baseCheck.allowed=false when authz disabled (degrade to base only)', async () => {
    mockUseAuthzEnabled.mockReturnValue(false);
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });

    const { result } = renderEnvHook('development');

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('bypasses env-eval when no environment supplied, regardless of authzEnabled', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderEnvHook(undefined);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.allowed).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
