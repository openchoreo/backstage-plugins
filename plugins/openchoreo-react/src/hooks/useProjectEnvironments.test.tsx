import { renderHook, waitFor } from '@testing-library/react';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useProjectEnvironments } from './useProjectEnvironments';

// ---- Mocks ----

const mockDiscoveryApi = { getBaseUrl: jest.fn() };
const mockFetchApi = { fetch: jest.fn() };
const mockCatalogApi = { getEntities: jest.fn() };

// ---- Helpers ----

const okJsonResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => body,
  } as unknown as Response);

const errResponse = (status: number, statusText: string) =>
  ({
    ok: false,
    status,
    statusText,
    json: async () => ({}),
  } as unknown as Response);

const envEntity = (name: string, dpName = 'dp-1') => ({
  metadata: {
    name,
    namespace: 'ns-1',
    title: name === 'dev' ? 'Development' : undefined,
    annotations: {
      'openchoreo.io/namespace': 'ns-1',
      'openchoreo.io/data-plane-ref': dpName,
      'openchoreo.io/data-plane-ref-kind': 'DataPlane',
    },
  },
});

function renderHookWithApis() {
  return renderHook(
    ({ project, namespace }: { project?: string; namespace?: string }) =>
      useProjectEnvironments(project, namespace),
    {
      initialProps: { project: 'proj-1', namespace: 'ns-1' } as {
        project?: string;
        namespace?: string;
      },
      wrapper: createQueryWrapper([
        [discoveryApiRef, mockDiscoveryApi as any],
        [fetchApiRef, mockFetchApi as any],
        [catalogApiRef, mockCatalogApi as any],
      ]),
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockDiscoveryApi.getBaseUrl.mockResolvedValue('http://localhost/openchoreo');
});

describe('useProjectEnvironments', () => {
  it('returns an empty list immediately when projectName is undefined', async () => {
    const { result } = renderHook(
      () => useProjectEnvironments(undefined, 'ns-1'),
      {
        wrapper: createQueryWrapper([
          [discoveryApiRef, mockDiscoveryApi as any],
          [fetchApiRef, mockFetchApi as any],
          [catalogApiRef, mockCatalogApi as any],
        ]),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(mockFetchApi.fetch).not.toHaveBeenCalled();
    expect(mockCatalogApi.getEntities).not.toHaveBeenCalled();
  });

  it('returns an empty list immediately when namespaceName is undefined', async () => {
    const { result } = renderHook(
      () => useProjectEnvironments('proj-1', undefined),
      {
        wrapper: createQueryWrapper([
          [discoveryApiRef, mockDiscoveryApi as any],
          [fetchApiRef, mockFetchApi as any],
          [catalogApiRef, mockCatalogApi as any],
        ]),
      },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments).toEqual([]);
    expect(mockFetchApi.fetch).not.toHaveBeenCalled();
  });

  it('builds envs in pipeline order, hydrating from the catalog', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okJsonResponse({
        promotionPaths: [
          {
            sourceEnvironmentRef: 'dev',
            targetEnvironmentRefs: [{ name: 'stage' }],
          },
          {
            sourceEnvironmentRef: 'stage',
            targetEnvironmentRefs: [{ name: 'prod' }],
          },
        ],
      }),
    );
    // Catalog returns them in a different (alphabetical) order on purpose.
    mockCatalogApi.getEntities.mockResolvedValueOnce({
      items: [
        envEntity('dev', 'dp-a'),
        envEntity('prod', 'dp-c'),
        envEntity('stage', 'dp-b'),
      ],
    });

    const { result } = renderHookWithApis();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.status).toBe('ok');
    expect(result.current.environments.map(e => e.name)).toEqual([
      'dev',
      'stage',
      'prod',
    ]);
    expect(result.current.environments[0]).toEqual({
      name: 'dev',
      displayName: 'Development',
      namespace: 'ns-1',
      dataPlaneRef: { name: 'dp-a', kind: 'DataPlane' },
    });
    // The undefined title falls back to env name.
    expect(result.current.environments[1].displayName).toBe('stage');
  });

  it('hits the openchoreo backend with the expected URL', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okJsonResponse({ promotionPaths: [] }),
    );

    renderHookWithApis();
    await waitFor(() => expect(mockFetchApi.fetch).toHaveBeenCalled());

    expect(mockDiscoveryApi.getBaseUrl).toHaveBeenCalledWith('openchoreo');
    const url = mockFetchApi.fetch.mock.calls[0][0] as string;
    expect(url).toContain('/deployment-pipeline?');
    expect(url).toContain('projectName=proj-1');
    expect(url).toContain('namespaceName=ns-1');
  });

  it('handles branching promotion paths (one source → multiple targets, fan-in)', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okJsonResponse({
        // dev → [stage-a, stage-b] → prod (fan-out then fan-in)
        promotionPaths: [
          {
            sourceEnvironmentRef: 'dev',
            targetEnvironmentRefs: [{ name: 'stage-a' }, { name: 'stage-b' }],
          },
          {
            sourceEnvironmentRef: 'stage-a',
            targetEnvironmentRefs: [{ name: 'prod' }],
          },
          {
            sourceEnvironmentRef: 'stage-b',
            targetEnvironmentRefs: [{ name: 'prod' }],
          },
        ],
      }),
    );
    mockCatalogApi.getEntities.mockResolvedValueOnce({
      items: ['dev', 'stage-a', 'stage-b', 'prod'].map(n => envEntity(n)),
    });

    const { result } = renderHookWithApis();
    await waitFor(() => expect(result.current.loading).toBe(false));

    // dev first, both stages before prod (declaration order), prod once (dedup).
    expect(result.current.environments.map(e => e.name)).toEqual([
      'dev',
      'stage-a',
      'stage-b',
      'prod',
    ]);
  });

  it('accepts sourceEnvironmentRef as either a string or { name }', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okJsonResponse({
        promotionPaths: [
          // Object form on source
          {
            sourceEnvironmentRef: { name: 'dev' },
            targetEnvironmentRefs: [{ name: 'stage' }],
          },
        ],
      }),
    );
    mockCatalogApi.getEntities.mockResolvedValueOnce({
      items: ['dev', 'stage'].map(n => envEntity(n)),
    });

    const { result } = renderHookWithApis();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments.map(e => e.name)).toEqual([
      'dev',
      'stage',
    ]);
  });

  it('reports empty-pipeline status when promotionPaths is empty (no catalog hit)', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okJsonResponse({ promotionPaths: [] }),
    );

    const { result } = renderHookWithApis();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments).toEqual([]);
    expect(result.current.status).toBe('empty-pipeline');
    expect(mockCatalogApi.getEntities).not.toHaveBeenCalled();
  });

  it('falls back to env name + namespace param when catalog has no matching entry', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(
      okJsonResponse({
        promotionPaths: [
          { sourceEnvironmentRef: 'orphan', targetEnvironmentRefs: [] },
        ],
      }),
    );
    mockCatalogApi.getEntities.mockResolvedValueOnce({ items: [] });

    const { result } = renderHookWithApis();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments).toEqual([
      {
        name: 'orphan',
        displayName: 'orphan',
        namespace: 'ns-1',
        dataPlaneRef: { name: undefined, kind: 'DataPlane' },
      },
    ]);
  });

  it('reports unavailable status when the pipeline endpoint fails', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(errResponse(500, 'boom'));

    const { result } = renderHookWithApis();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments).toEqual([]);
    expect(result.current.status).toBe('unavailable');
    expect(result.current.error).toContain('500');
  });

  it('reports forbidden status when the pipeline read is denied (403)', async () => {
    mockFetchApi.fetch.mockResolvedValueOnce(errResponse(403, 'Forbidden'));

    const { result } = renderHookWithApis();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments).toEqual([]);
    expect(result.current.status).toBe('forbidden');
    expect(mockCatalogApi.getEntities).not.toHaveBeenCalled();
  });

  it('reports an error when fetch throws', async () => {
    mockFetchApi.fetch.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHookWithApis();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.environments).toEqual([]);
    expect(result.current.error).toBe('network down');
  });

  it('refetches when projectName changes', async () => {
    mockFetchApi.fetch
      .mockResolvedValueOnce(
        okJsonResponse({
          promotionPaths: [
            { sourceEnvironmentRef: 'dev', targetEnvironmentRefs: [] },
          ],
        }),
      )
      .mockResolvedValueOnce(
        okJsonResponse({
          promotionPaths: [
            { sourceEnvironmentRef: 'prod', targetEnvironmentRefs: [] },
          ],
        }),
      );
    mockCatalogApi.getEntities
      .mockResolvedValueOnce({ items: [envEntity('dev')] })
      .mockResolvedValueOnce({ items: [envEntity('prod')] });

    const { result, rerender } = renderHookWithApis();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.environments.map(e => e.name)).toEqual(['dev']);

    rerender({ project: 'proj-2', namespace: 'ns-1' });
    await waitFor(() =>
      expect(result.current.environments.map(e => e.name)).toEqual(['prod']),
    );
  });
});
