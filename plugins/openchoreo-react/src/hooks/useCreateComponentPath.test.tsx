import { renderHook, waitFor } from '@testing-library/react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useCreateComponentPath } from './useCreateComponentPath';

const entity = {
  kind: 'System',
  metadata: { name: 'proj', namespace: 'team-ns' },
} as any;

const mockCatalogApi = { getEntityFacets: jest.fn() };

function renderPath(e = entity) {
  return renderHook(() => useCreateComponentPath(e), {
    wrapper: createQueryWrapper([[catalogApiRef, mockCatalogApi as any]]),
  });
}

function namespaceFilters(path: string): string[] {
  return new URLSearchParams(path.split('?')[1]).getAll('filters[namespace]');
}

describe('useCreateComponentPath', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports loading on first render, then clears it', async () => {
    mockCatalogApi.getEntityFacets.mockResolvedValue({
      facets: { 'metadata.name': [] },
    });
    const { result } = renderPath();

    expect(result.current.loading).toBe(true);
    expect(result.current.isRefetching).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('checks for cluster-scoped Component templates', async () => {
    mockCatalogApi.getEntityFacets.mockResolvedValue({
      facets: { 'metadata.name': [] },
    });
    renderPath();

    await waitFor(() =>
      expect(mockCatalogApi.getEntityFacets).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: {
            kind: 'Template',
            'metadata.namespace': 'openchoreo-cluster',
            'spec.type': 'Component',
          },
          facets: ['metadata.name'],
        }),
      ),
    );
  });

  it('includes the cluster namespace when cluster component templates exist', async () => {
    mockCatalogApi.getEntityFacets.mockResolvedValue({
      facets: { 'metadata.name': [{ value: 'svc', count: 1 }] },
    });
    const { result } = renderPath();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(namespaceFilters(result.current.path)).toEqual([
      'team-ns',
      'openchoreo-cluster',
    ]);
    expect(result.current.isRefetching).toBe(false);
  });

  it('omits the cluster namespace when there are no cluster component templates', async () => {
    mockCatalogApi.getEntityFacets.mockResolvedValue({
      facets: { 'metadata.name': [] },
    });
    const { result } = renderPath();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(namespaceFilters(result.current.path)).toEqual(['team-ns']);
  });

  it('falls back to the project namespace if the facet query fails', async () => {
    mockCatalogApi.getEntityFacets.mockRejectedValue(new Error('down'));
    const { result } = renderPath();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(namespaceFilters(result.current.path)).toEqual(['team-ns']);
  });

  it('defaults the namespace to "default" when the entity has none', async () => {
    mockCatalogApi.getEntityFacets.mockResolvedValue({
      facets: { 'metadata.name': [] },
    });
    const { result } = renderPath({
      kind: 'System',
      metadata: { name: 'proj' },
    } as any);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(namespaceFilters(result.current.path)).toEqual(['default']);
  });
});
