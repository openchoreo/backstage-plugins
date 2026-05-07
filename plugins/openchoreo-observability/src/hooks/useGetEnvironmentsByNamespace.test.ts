import { renderHook, waitFor } from '@testing-library/react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { useGetEnvironmentsByNamespace } from './useGetEnvironmentsByNamespace';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useGetEnvironmentsByNamespace', () => {
  const getBaseUrl = jest.fn();
  const fetch = jest.fn();
  // Stable singletons — useApi must return the same reference on every call,
  // otherwise the hook's effect dep array sees a new object per render and
  // re-runs forever.
  const discoveryApi = { getBaseUrl };
  const fetchApi = { fetch };

  beforeEach(() => {
    jest.clearAllMocks();
    getBaseUrl.mockResolvedValue('http://backend/api/observability');
    (useApi as jest.Mock).mockImplementation(ref => {
      if (ref === discoveryApiRef) return discoveryApi;
      if (ref === fetchApiRef) return fetchApi;
      return undefined;
    });
  });

  const okResponse = (environments: any[]) => ({
    ok: true,
    json: async () => ({ environments }),
  });

  it('omits the project query parameter when no project is given', async () => {
    fetch.mockResolvedValueOnce(okResponse([{ name: 'dev' }]));

    const { result } = renderHook(() => useGetEnvironmentsByNamespace('ns-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).toHaveBeenCalledTimes(1);
    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('namespace=ns-1');
    expect(url).not.toContain('project=');
    expect(result.current.environments).toEqual([{ name: 'dev' }]);
  });

  it('forwards the project query parameter when provided', async () => {
    fetch.mockResolvedValueOnce(okResponse([{ name: 'dev' }]));

    const { result } = renderHook(() =>
      useGetEnvironmentsByNamespace('ns-1', 'proj-1'),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('namespace=ns-1');
    expect(url).toContain('project=proj-1');
  });

  it('reports an error when the namespace is missing', async () => {
    const { result } = renderHook(() =>
      useGetEnvironmentsByNamespace(undefined),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.error).toBe('Namespace name is required');
    expect(result.current.environments).toEqual([]);
  });

  it('reports an error when the response is not ok', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    });

    const { result } = renderHook(() => useGetEnvironmentsByNamespace('ns-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toMatch(/Failed to fetch environments/);
  });
});
