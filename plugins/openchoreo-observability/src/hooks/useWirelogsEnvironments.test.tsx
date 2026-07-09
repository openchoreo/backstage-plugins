import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { useWirelogsEnvironments } from './useWirelogsEnvironments';

const mockUseProjectEnvironments = jest.fn();
// Keep the real caching wrapper (useOpenChoreoQuery); only stub the base
// environments hook so tests can drive its return.
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
  return renderHook(() => useWirelogsEnvironments('proj-1', 'ns-1'), {
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

describe('useWirelogsEnvironments', () => {
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

  it('surfaces the underlying environments error', () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [],
      loading: false,
      error: 'broken',
    });
    const { result } = setup();
    expect(result.current.error).toBe('broken');
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

  it('flags an env as hasWirelogs=true when its DataPlane reports cilium', async () => {
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
        hasWirelogs: true,
      },
    ]);
  });

  it('flags hasWirelogs=false when DataPlane has a different provider', async () => {
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
    expect(result.current.environments[0].hasWirelogs).toBe(false);
  });

  it('skips the probe (hasWirelogs=false) when the env has no dataPlaneRef', async () => {
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
        hasWirelogs: false,
      },
    ]);
    expect(mockFetchApi.fetch).not.toHaveBeenCalled();
  });

  it('treats a failed probe as hasWirelogs=false', async () => {
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
    expect(result.current.environments[0].hasWirelogs).toBe(false);
  });

  it('treats a thrown probe error (network failure / timeout) as hasWirelogs=false', async () => {
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
    expect(result.current.environments[0].hasWirelogs).toBe(false);
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

  it('mixes supported and unsupported envs in one pass', async () => {
    mockUseProjectEnvironments.mockReturnValue({
      environments: [
        {
          name: 'dev',
          namespace: 'ns-1',
          dataPlaneRef: { name: 'dp-1', kind: 'DataPlane' },
        },
        {
          name: 'prod',
          namespace: 'ns-1',
          dataPlaneRef: { name: 'dp-2', kind: 'DataPlane' },
        },
      ],
      loading: false,
      error: null,
    });
    mockFetchApi.fetch
      .mockResolvedValueOnce(okResponse({ networkPolicyProvider: 'cilium' }))
      .mockResolvedValueOnce(okResponse({ networkPolicyProvider: 'calico' }));

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));
    const byName = Object.fromEntries(
      result.current.environments.map(e => [e.name, e.hasWirelogs]),
    );
    expect(byName).toEqual({ dev: true, prod: false });
  });
});
