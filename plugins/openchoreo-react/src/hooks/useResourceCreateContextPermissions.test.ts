import { renderHook, waitFor } from '@testing-library/react';
import { useResourceCreateContextPermissions } from './useResourceCreateContextPermissions';
import type { ResourceCreateContextItem } from './useResourceCreateContextPermissions';

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

jest.mock('@openchoreo/backstage-plugin-common', () => ({
  openchoreoResourceCreatePermission: {
    type: 'basic',
    name: 'openchoreo.resource.create',
    attributes: { action: 'create' },
  },
}));

const ITEMS: ResourceCreateContextItem[] = [
  { key: 'template:default/postgres', resourceType: { name: 'postgres' } },
  { key: 'template:default/redis', resourceType: { name: 'redis' } },
];

function renderBatch(
  items: ResourceCreateContextItem[],
  namespace?: string,
  project?: string,
) {
  return renderHook(() =>
    useResourceCreateContextPermissions({ items, namespace, project }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBaseUrl.mockResolvedValue('http://localhost/api/permission');
  mockUseAuthzEnabled.mockReturnValue(true);
});

describe('useResourceCreateContextPermissions', () => {
  it('returns per-item decisions when backend allows some and denies others', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    // postgres → allowed, redis → denied (keyed off the request body)
    mockFetch.mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({ allowed: body.resourceType.name === 'postgres' }),
      };
    });

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/postgres']?.loading,
      ).toBe(false),
    );

    expect(result.current.decisions['template:default/postgres'].allowed).toBe(
      true,
    );
    expect(result.current.decisions['template:default/redis'].allowed).toBe(
      false,
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('sends one request per item with the shared scope', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    const bodies = mockFetch.mock.calls.map(c => JSON.parse(c[1].body));
    expect(bodies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          permissionName: 'openchoreo.resource.create',
          namespace: 'acme',
          project: 'payments',
          resourceType: { name: 'postgres', kind: undefined },
        }),
        expect.objectContaining({
          resourceType: { name: 'redis', kind: undefined },
        }),
      ]),
    );
  });

  it('degrades to base check (no fetch) when authz disabled', async () => {
    mockUseAuthzEnabled.mockReturnValue(false);
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/postgres']?.loading,
      ).toBe(false),
    );
    expect(result.current.decisions['template:default/postgres'].allowed).toBe(
      true,
    );
    expect(result.current.decisions['template:default/redis'].allowed).toBe(
      true,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('denies every item without a fetch when base check is denied', async () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/postgres']?.loading,
      ).toBe(false),
    );
    expect(result.current.decisions['template:default/postgres'].allowed).toBe(
      false,
    );
    expect(result.current.decisions['template:default/redis'].allowed).toBe(
      false,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it.each([
    ['no namespace', undefined, 'payments'],
    ['no project', 'acme', undefined],
  ])(
    'skips the contextual call and mirrors base check (%s)',
    async (_label, namespace, project) => {
      mockUsePermission.mockReturnValue({ allowed: true, loading: false });

      const { result } = renderBatch(ITEMS, namespace, project);

      await waitFor(() =>
        expect(
          result.current.decisions['template:default/postgres']?.loading,
        ).toBe(false),
      );
      expect(
        result.current.decisions['template:default/postgres'].allowed,
      ).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    },
  );

  it('returns an empty decision map for an empty item list', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });

    const { result } = renderBatch([], 'acme', 'payments');

    await waitFor(() => expect(mockGetBaseUrl).not.toHaveBeenCalled());
    expect(result.current.decisions).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fails closed per item on a rejected request', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.resourceType.name === 'redis') throw new Error('boom');
      return { ok: true, json: async () => ({ allowed: true }) };
    });

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/postgres']?.loading,
      ).toBe(false),
    );
    expect(result.current.decisions['template:default/postgres'].allowed).toBe(
      true,
    );
    expect(result.current.decisions['template:default/redis'].allowed).toBe(
      false,
    );
  });

  it('fails closed per item on a non-ok response', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.resourceType.name === 'redis') {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ allowed: true }) };
    });

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/postgres']?.loading,
      ).toBe(false),
    );
    expect(result.current.decisions['template:default/postgres'].allowed).toBe(
      true,
    );
    expect(result.current.decisions['template:default/redis'].allowed).toBe(
      false,
    );
  });

  it('fails closed for all items when discovery cannot resolve the base URL', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockGetBaseUrl.mockRejectedValue(new Error('no discovery'));

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/postgres']?.loading,
      ).toBe(false),
    );
    expect(result.current.decisions['template:default/postgres'].allowed).toBe(
      false,
    );
    expect(result.current.decisions['template:default/redis'].allowed).toBe(
      false,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('forwards resourceType.kind to the backend', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    const items: ResourceCreateContextItem[] = [
      {
        key: 'template:openchoreo-cluster/cluster-postgres',
        resourceType: { name: 'postgres', kind: 'ClusterResourceType' },
      },
    ];
    renderBatch(items, 'acme', 'payments');

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.resourceType).toEqual({
      name: 'postgres',
      kind: 'ClusterResourceType',
    });
  });
});
