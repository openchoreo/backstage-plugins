import { renderHook, waitFor } from '@testing-library/react';
import { useBuildPermission } from './useBuildPermission';

const mockUsePermission = jest.fn();
jest.mock('@backstage/plugin-permission-react', () => ({
  usePermission: (...args: any[]) => mockUsePermission(...args),
}));

jest.mock('@backstage/plugin-catalog-react', () => ({
  useEntity: () => ({
    entity: {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'Component',
      metadata: { name: 'test', namespace: 'default' },
    },
  }),
}));

jest.mock('@backstage/catalog-model', () => ({
  stringifyEntityRef: () => 'component:default/test',
}));

// useBuildPermission routes the trigger-build check through
// useWorkflowScopedPermission, which reads discovery/fetch APIs and the authz
// feature flag. Mock them the same way useEnvScopedPermission.test.ts does so
// the hook can render. Stable API singletons keep useApi referentially stable
// across renders (the workflow-eval useEffect has them in its dep array).
const mockGetBaseUrl = jest.fn();
const mockFetch = jest.fn();
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

describe('useBuildPermission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetBaseUrl.mockResolvedValue('http://localhost/api/permission');
    // Default: no workflow passed in the existing cases, so the workflow-eval
    // path is skipped regardless. Authz enabled is irrelevant when no workflow
    // is supplied, but default it on for realism.
    mockUseAuthzEnabled.mockReturnValue(true);
  });

  // --- Behavior without a workflow (backward-compatible visibility check) ---

  it('returns both permissions allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    const { result } = renderHook(() => useBuildPermission());

    expect(result.current.canBuild).toBe(true);
    expect(result.current.canView).toBe(true);
    expect(result.current.triggerBuildDeniedTooltip).toBe('');
    expect(result.current.viewBuildDeniedTooltip).toBe('');
  });

  it('returns loading state for both permissions', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: true });
    const { result } = renderHook(() => useBuildPermission());

    expect(result.current.triggerLoading).toBe(true);
    expect(result.current.viewLoading).toBe(true);
    expect(result.current.triggerBuildDeniedTooltip).toBe('');
    expect(result.current.viewBuildDeniedTooltip).toBe('');
  });

  it('returns denied tooltips when not allowed', () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });
    const { result } = renderHook(() => useBuildPermission());

    expect(result.current.canBuild).toBe(false);
    expect(result.current.canView).toBe(false);
    expect(result.current.triggerBuildDeniedTooltip).toBeTruthy();
    expect(result.current.viewBuildDeniedTooltip).toBeTruthy();
  });

  it('does not call /evaluate-with-context when no workflow is supplied', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useBuildPermission());

    // Give any stray effect a chance to fire.
    await Promise.resolve();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls usePermission with entity resource ref', () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    renderHook(() => useBuildPermission());

    // canView uses usePermission directly; canBuild routes through
    // useWorkflowScopedPermission, which also calls usePermission internally.
    expect(mockUsePermission).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceRef: 'component:default/test',
      }),
    );
  });

  // --- Behavior with a workflow (workflow-scoped ABAC check) ---

  it('evaluates the workflow against /evaluate-with-context and ANDs the result', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    const { result } = renderHook(() =>
      useBuildPermission({ name: 'build-go', kind: 'Workflow' }),
    );

    await waitFor(() => expect(result.current.triggerLoading).toBe(false));

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost/api/permission/evaluate-with-context',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"workflow"'),
      }),
    );
    // Visibility allowed AND workflow-eval allowed → canBuild true.
    expect(result.current.canBuild).toBe(true);
    // canView is the plain visibility check, unaffected by the workflow.
    expect(result.current.canView).toBe(true);
  });

  it('denies the build when the workflow-scoped evaluation returns false', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: false }),
    });

    const { result } = renderHook(() =>
      useBuildPermission({ name: 'build-go', kind: 'Workflow' }),
    );

    await waitFor(() => expect(result.current.triggerLoading).toBe(false));

    // Visibility passed but the workflow-specific check denied → canBuild false.
    expect(result.current.canBuild).toBe(false);
    expect(result.current.triggerBuildDeniedTooltip).toBeTruthy();
  });

  it('sends the workflow name and kind in the request body', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    const { result } = renderHook(() =>
      useBuildPermission({ name: 'build-go', kind: 'ClusterWorkflow' }),
    );

    await waitFor(() => expect(result.current.triggerLoading).toBe(false));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.workflow).toEqual({
      name: 'build-go',
      kind: 'ClusterWorkflow',
    });
  });

  it('skips the workflow-eval and uses visibility when authz is disabled', async () => {
    mockUseAuthzEnabled.mockReturnValue(false);
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderHook(() =>
      useBuildPermission({ name: 'build-go', kind: 'Workflow' }),
    );

    await Promise.resolve();
    // No backend call, and canBuild falls back to the visibility decision.
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.canBuild).toBe(true);
  });
});
