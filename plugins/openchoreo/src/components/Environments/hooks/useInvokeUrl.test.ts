import { renderHook, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useInvokeUrl } from './useInvokeUrl';

// The tree → URL extraction is exercised by invokeUrlUtils' own tests; here we
// stub it so the hook's fetch/gating behaviour is what's under test.
jest.mock('../utils/invokeUrlUtils', () => ({
  extractInvokeUrlFromTree: jest.fn(() => 'https://checkout.example.com'),
}));

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'checkout',
    namespace: 'default',
    annotations: { 'openchoreo.io/namespace': 'ns-1' },
  },
};

function renderUseInvokeUrl(
  client: any,
  opts: {
    releaseName?: string;
    status?: 'Ready' | 'NotReady' | 'Failed';
  } = { releaseName: 'release-1', status: 'Ready' },
) {
  return renderHook(
    () =>
      useInvokeUrl(
        entity,
        'production',
        'checkout',
        opts.releaseName,
        opts.status,
        'dp-1',
        'binding-1',
      ),
    {
      wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
    },
  );
}

describe('useInvokeUrl', () => {
  it('does not fetch (stays disabled) when there is no deployment', async () => {
    const client = {
      fetchDataPlaneDetails: jest.fn(),
      fetchResourceTree: jest.fn(),
    };
    const { result } = renderUseInvokeUrl(client, {
      releaseName: undefined,
      status: undefined,
    });

    // A disabled query never fetches and never resolves a URL.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.invokeUrl).toBeNull();
    expect(result.current.isRefetching).toBe(false);
    expect(client.fetchResourceTree).not.toHaveBeenCalled();
  });

  it('resolves the invoke URL from the resource tree', async () => {
    const client = {
      fetchDataPlaneDetails: jest.fn().mockResolvedValue({
        gateway: { ingress: { external: { http: { port: 443 } } } },
      }),
      fetchResourceTree: jest.fn().mockResolvedValue({ some: 'tree' }),
    };
    const { result } = renderUseInvokeUrl(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.invokeUrl).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.invokeUrl).toBe('https://checkout.example.com');
    expect(result.current.isRefetching).toBe(false);
    expect(client.fetchResourceTree).toHaveBeenCalledWith('ns-1', 'binding-1');
  });

  it('swallows fetch failures and resolves to null', async () => {
    const client = {
      fetchDataPlaneDetails: jest.fn().mockRejectedValue(new Error('nope')),
      fetchResourceTree: jest.fn().mockRejectedValue(new Error('boom')),
    };
    const { result } = renderUseInvokeUrl(client);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.invokeUrl).toBeNull();
  });
});
