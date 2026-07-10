import { renderHook, waitFor } from '@testing-library/react';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useReleaseReadiness } from './useReleaseReadiness';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'checkout',
    namespace: 'default',
    annotations: {
      'openchoreo.io/project': 'proj-1',
      'openchoreo.io/namespace': 'ns-1',
    },
  },
};

const mockDiscoveryApi = { getBaseUrl: jest.fn() };
const mockFetchApi = { fetch: jest.fn() };

const okResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body } as unknown as Response);

function renderUseReleaseReadiness(client: any) {
  return renderHook(() => useReleaseReadiness(entity), {
    wrapper: createQueryWrapper([
      [openChoreoClientApiRef, client],
      [discoveryApiRef, mockDiscoveryApi as any],
      [fetchApiRef, mockFetchApi as any],
    ]),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDiscoveryApi.getBaseUrl.mockResolvedValue('http://localhost/openchoreo');
});

describe('useReleaseReadiness', () => {
  it('starts loading with readiness gated off', () => {
    const client = {
      fetchWorkloadInfo: jest.fn().mockReturnValue(new Promise(() => {})),
    };
    const { result } = renderUseReleaseReadiness(client);

    expect(result.current.loading).toBe(true);
    expect(result.current.canCreateRelease).toBe(false);
    expect(result.current.isRefetching).toBe(false);
  });

  it('allows a release once the workload exists (non-source component)', async () => {
    const client = {
      fetchWorkloadInfo: jest.fn().mockResolvedValue({}),
    };
    mockFetchApi.fetch.mockResolvedValue(okResponse([]));
    const { result } = renderUseReleaseReadiness(client);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasWorkload).toBe(true);
    expect(result.current.canCreateRelease).toBe(true);
    expect(result.current.alertMessage).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('blocks a release and explains why when the workload is missing', async () => {
    const client = {
      fetchWorkloadInfo: jest.fn().mockRejectedValue(new Error('404')),
    };
    mockFetchApi.fetch.mockResolvedValue(okResponse([]));
    const { result } = renderUseReleaseReadiness(client);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasWorkload).toBe(false);
    expect(result.current.canCreateRelease).toBe(false);
    expect(result.current.alertMessage).toBe(
      'Configure your workload to enable deployment.',
    );
    expect(result.current.alertSeverity).toBe('info');
  });
});
