import { renderHook, waitFor } from '@testing-library/react';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useCellEnvironments } from './useCellEnvironments';

// Mock useProjectEnvironments directly; we only exercise the Cilium probe
// layered on top. Spread the real module so the hook's own
// `useOpenChoreoQuery` import survives the mock.
const mockUseProjectEnvironments = jest.fn();
jest.mock('@openchoreo/backstage-plugin-react', () => ({
  ...jest.requireActual('@openchoreo/backstage-plugin-react'),
  useProjectEnvironments: (...args: any[]) =>
    mockUseProjectEnvironments(...args),
}));

const mockDiscoveryApi = { getBaseUrl: jest.fn() };
const mockFetchApi = { fetch: jest.fn() };

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body } as unknown as Response);

const errResponse = (status: number) =>
  ({ ok: false, status, json: async () => ({}) } as unknown as Response);

function setup() {
  return renderHook(() => useCellEnvironments('proj-1', 'ns-1'), {
    wrapper: createQueryWrapper([
      [discoveryApiRef, mockDiscoveryApi as any],
      [fetchApiRef, mockFetchApi as any],
    ]),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDiscoveryApi.getBaseUrl.mockResolvedValue(
    'http://localhost/observability-backend',
  );
});

describe('useCellEnvironments', () => {
  it('returns loading=true while the underlying envs are still loading', () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [],
      loading: true,
      error: null,
    });
    const { result } = setup();
    expect(result.current.loading).toBe(true);
    expect(result.current.environments).toEqual([]);
    expect(mockFetchApi.fetch).not.toHaveBeenCalled();
  });

  it('returns an empty list (no probe calls) when the upstream resolves to zero envs', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      error: null,
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments).toEqual([]);
    expect(mockFetchApi.fetch).not.toHaveBeenCalled();
  });

  it('flags an env as hasRuntimeObservability=true when its DataPlane reports cilium', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [
        {
          name: 'dev',
          namespace: 'ns-1',
          dataPlaneRef: { name: 'dp-1', kind: 'DataPlane' },
        },
      ],
      loading: false,
      error: null,
    });
    mockFetchApi.fetch.mockResolvedValueOnce(
      okResponse({ networkPolicyProvider: 'cilium' }),
    );

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments).toEqual([
      {
        name: 'dev',
        namespace: 'ns-1',
        dataPlaneRef: { name: 'dp-1', kind: 'DataPlane' },
        hasRuntimeObservability: true,
      },
    ]);
  });

  it('flags hasRuntimeObservability=false when DataPlane has a different provider', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [
        {
          name: 'dev',
          namespace: 'ns-1',
          dataPlaneRef: { name: 'dp-1', kind: 'DataPlane' },
        },
      ],
      loading: false,
      error: null,
    });
    mockFetchApi.fetch.mockResolvedValueOnce(
      okResponse({ networkPolicyProvider: 'calico' }),
    );

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments[0].hasRuntimeObservability).toBe(false);
  });

  it('skips the probe (hasRuntimeObservability=false) when the env has no dataPlaneRef', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [{ name: 'dev', namespace: 'ns-1' /* no dataPlaneRef */ }],
      loading: false,
      error: null,
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments).toEqual([
      {
        name: 'dev',
        namespace: 'ns-1',
        hasRuntimeObservability: false,
      },
    ]);
    expect(mockFetchApi.fetch).not.toHaveBeenCalled();
  });

  it('treats a failed probe as hasRuntimeObservability=false', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [
        {
          name: 'dev',
          namespace: 'ns-1',
          dataPlaneRef: { name: 'dp-1', kind: 'DataPlane' },
        },
      ],
      loading: false,
      error: null,
    });
    mockFetchApi.fetch.mockResolvedValueOnce(errResponse(500));

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments[0].hasRuntimeObservability).toBe(false);
  });

  it('treats a thrown probe error (network failure / timeout) as hasRuntimeObservability=false', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [
        {
          name: 'dev',
          namespace: 'ns-1',
          dataPlaneRef: { name: 'dp-1', kind: 'DataPlane' },
        },
      ],
      loading: false,
      error: null,
    });
    mockFetchApi.fetch.mockRejectedValueOnce(new Error('boom'));

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments[0].hasRuntimeObservability).toBe(false);
  });

  it('returns an empty list when discoveryApi.getBaseUrl fails', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [
        {
          name: 'dev',
          namespace: 'ns-1',
          dataPlaneRef: { name: 'dp-1', kind: 'DataPlane' },
        },
      ],
      loading: false,
      error: null,
    });
    mockDiscoveryApi.getBaseUrl.mockRejectedValueOnce(
      new Error('no discovery'),
    );

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments).toEqual([]);
  });

  it('keeps loading=false during a background refetch (does not blank on refresh)', async () => {
    // Regression: a background refresh must not fold into `loading`, or the
    // cell diagram re-shows its full skeleton every staleTime window instead of
    // keeping the cached diagram on screen.
    mockUseProjectEnvironments.mockReturnValue({
      environments: [
        {
          name: 'dev',
          namespace: 'ns-1',
          dataPlaneRef: { name: 'dp-1', kind: 'DataPlane' },
        },
      ],
      loading: false,
      error: null,
    });
    mockFetchApi.fetch.mockResolvedValue(
      okResponse({ networkPolicyProvider: 'cilium' }),
    );

    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments).toHaveLength(1);

    // Force a refetch and assert loading stays false throughout — only
    // isRefetching may flip. Data remains on screen.
    rerender();
    expect(result.current.loading).toBe(false);
    expect(result.current.environments).toHaveLength(1);
  });

  it('defaults dataPlaneRef.kind to DataPlane in the probe params', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [
        {
          name: 'dev',
          namespace: 'ns-1',
          dataPlaneRef: { name: 'dp-1' /* kind omitted */ },
        },
      ],
      loading: false,
      error: null,
    });
    mockFetchApi.fetch.mockResolvedValueOnce(
      okResponse({ networkPolicyProvider: 'cilium' }),
    );

    setup();
    await waitFor(() => expect(mockFetchApi.fetch).toHaveBeenCalled());
    const url = mockFetchApi.fetch.mock.calls[0][0] as string;
    expect(url).toContain('dpKind=DataPlane');
  });
});
