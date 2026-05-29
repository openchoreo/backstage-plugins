import { renderHook, waitFor } from '@testing-library/react';
import { useComponentCreateContextPermissions } from './useComponentCreateContextPermissions';
import type { ComponentCreateContextItem } from './useComponentCreateContextPermissions';

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
  openchoreoComponentCreatePermission: {
    type: 'basic',
    name: 'openchoreo.component.create',
    attributes: { action: 'create' },
  },
}));

const ITEMS: ComponentCreateContextItem[] = [
  { key: 'template:default/service', componentType: { name: 'service' } },
  { key: 'template:default/web', componentType: { name: 'web' } },
];

function renderBatch(
  items: ComponentCreateContextItem[],
  namespace?: string,
  project?: string,
) {
  return renderHook(() =>
    useComponentCreateContextPermissions({ items, namespace, project }),
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetBaseUrl.mockResolvedValue('http://localhost/api/permission');
  mockUseAuthzEnabled.mockReturnValue(true);
});

describe('useComponentCreateContextPermissions', () => {
  it('returns per-item decisions when backend allows some and denies others', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    // service → allowed, web → denied (keyed off the request body)
    mockFetch.mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({ allowed: body.componentType.name === 'service' }),
      };
    });

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/service']?.loading,
      ).toBe(false),
    );

    expect(result.current.decisions['template:default/service'].allowed).toBe(
      true,
    );
    expect(result.current.decisions['template:default/web'].allowed).toBe(
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
          permissionName: 'openchoreo.component.create',
          namespace: 'acme',
          project: 'payments',
          componentType: { name: 'service', kind: undefined },
        }),
        expect.objectContaining({
          componentType: { name: 'web', kind: undefined },
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
        result.current.decisions['template:default/service']?.loading,
      ).toBe(false),
    );
    expect(result.current.decisions['template:default/service'].allowed).toBe(
      true,
    );
    expect(result.current.decisions['template:default/web'].allowed).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('denies every item without a fetch when base check is denied', async () => {
    mockUsePermission.mockReturnValue({ allowed: false, loading: false });

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/service']?.loading,
      ).toBe(false),
    );
    expect(result.current.decisions['template:default/service'].allowed).toBe(
      false,
    );
    expect(result.current.decisions['template:default/web'].allowed).toBe(
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
          result.current.decisions['template:default/service']?.loading,
        ).toBe(false),
      );
      expect(result.current.decisions['template:default/service'].allowed).toBe(
        true,
      );
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
      if (body.componentType.name === 'web') throw new Error('boom');
      return { ok: true, json: async () => ({ allowed: true }) };
    });

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/service']?.loading,
      ).toBe(false),
    );
    expect(result.current.decisions['template:default/service'].allowed).toBe(
      true,
    );
    expect(result.current.decisions['template:default/web'].allowed).toBe(
      false,
    );
  });

  it('fails closed per item on a non-ok response', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.componentType.name === 'web') {
        return { ok: false, json: async () => ({}) };
      }
      return { ok: true, json: async () => ({ allowed: true }) };
    });

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/service']?.loading,
      ).toBe(false),
    );
    expect(result.current.decisions['template:default/service'].allowed).toBe(
      true,
    );
    expect(result.current.decisions['template:default/web'].allowed).toBe(
      false,
    );
  });

  it('fails closed for all items when discovery cannot resolve the base URL', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockGetBaseUrl.mockRejectedValue(new Error('no discovery'));

    const { result } = renderBatch(ITEMS, 'acme', 'payments');

    await waitFor(() =>
      expect(
        result.current.decisions['template:default/service']?.loading,
      ).toBe(false),
    );
    expect(result.current.decisions['template:default/service'].allowed).toBe(
      false,
    );
    expect(result.current.decisions['template:default/web'].allowed).toBe(
      false,
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('forwards componentType.kind to the backend', async () => {
    mockUsePermission.mockReturnValue({ allowed: true, loading: false });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ allowed: true }),
    });

    const items: ComponentCreateContextItem[] = [
      {
        key: 'template:openchoreo-cluster/cluster-service',
        componentType: { name: 'service', kind: 'ClusterComponentType' },
      },
    ];
    renderBatch(items, 'acme', 'payments');

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.componentType).toEqual({
      name: 'service',
      kind: 'ClusterComponentType',
    });
  });
});
