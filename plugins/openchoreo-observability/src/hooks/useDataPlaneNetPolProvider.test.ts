import { renderHook, waitFor } from '@testing-library/react';
import {
  useApi,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useDataPlaneNetPolProvider } from './useDataPlaneNetPolProvider';

jest.mock('@backstage/core-plugin-api', () => {
  const actual = jest.requireActual('@backstage/core-plugin-api');
  return {
    ...actual,
    useApi: jest.fn(),
  };
});

describe('useDataPlaneNetPolProvider', () => {
  const getBaseUrl = jest.fn();
  const fetch = jest.fn();
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

  const okResponse = (networkPolicyProvider: string | undefined) => ({
    ok: true,
    json: async () => ({ networkPolicyProvider }),
  });

  it('returns undefined and is not loading when namespaceName is absent', async () => {
    const { result } = renderHook(
      () =>
        useDataPlaneNetPolProvider(undefined, {
          kind: 'DataPlane',
          name: 'dp-1',
        }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.networkPolicyProvider).toBeUndefined();
  });

  it('returns undefined and is not loading when dataPlaneRef.name is absent', async () => {
    const { result } = renderHook(
      () => useDataPlaneNetPolProvider('ns-1', { kind: 'DataPlane' }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.networkPolicyProvider).toBeUndefined();
  });

  it('returns undefined and is not loading when dataPlaneRef is undefined', async () => {
    const { result } = renderHook(
      () => useDataPlaneNetPolProvider('ns-1', undefined),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.networkPolicyProvider).toBeUndefined();
  });

  it('fetches and returns the network policy provider', async () => {
    fetch.mockResolvedValueOnce(okResponse('cilium'));

    const { result } = renderHook(
      () =>
        useDataPlaneNetPolProvider('ns-1', { kind: 'DataPlane', name: 'dp-1' }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.networkPolicyProvider).toBe('cilium');
    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('namespaceName=ns-1');
    expect(url).toContain('dpName=dp-1');
    expect(url).toContain('dpKind=DataPlane');
  });

  it('defaults dpKind to DataPlane when kind is absent', async () => {
    fetch.mockResolvedValueOnce(okResponse('cilium'));

    const { result } = renderHook(
      () => useDataPlaneNetPolProvider('ns-1', { name: 'dp-1' }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const url = fetch.mock.calls[0][0] as string;
    expect(url).toContain('dpKind=DataPlane');
  });

  it('returns undefined when the response is not ok', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Error',
    });

    const { result } = renderHook(
      () =>
        useDataPlaneNetPolProvider('ns-1', { kind: 'DataPlane', name: 'dp-1' }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.networkPolicyProvider).toBeUndefined();
  });

  it('returns undefined when the fetch throws', async () => {
    fetch.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(
      () =>
        useDataPlaneNetPolProvider('ns-1', { kind: 'DataPlane', name: 'dp-1' }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.networkPolicyProvider).toBeUndefined();
  });

  it('returns undefined when the annotation is not set', async () => {
    fetch.mockResolvedValueOnce(okResponse(undefined));

    const { result } = renderHook(
      () =>
        useDataPlaneNetPolProvider('ns-1', {
          kind: 'ClusterDataPlane',
          name: 'cdp-1',
        }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.networkPolicyProvider).toBeUndefined();
  });

  it('normalizes null from the API to undefined', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ networkPolicyProvider: null }),
    });

    const { result } = renderHook(
      () =>
        useDataPlaneNetPolProvider('ns-1', { kind: 'DataPlane', name: 'dp-1' }),
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.networkPolicyProvider).toBeUndefined();
  });
});
