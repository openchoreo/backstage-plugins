import { renderHook, waitFor } from '@testing-library/react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useCreateResourcePath } from './useCreateResourcePath';

const entity = {
  kind: 'System',
  metadata: { name: 'proj', namespace: 'team-ns' },
} as any;

const mockCatalogApi = { getEntityFacets: jest.fn() };

function renderPath() {
  return renderHook(() => useCreateResourcePath(entity), {
    wrapper: createQueryWrapper([[catalogApiRef, mockCatalogApi as any]]),
  });
}

function namespaceFilters(path: string): string[] {
  return new URLSearchParams(path.split('?')[1]).getAll('filters[namespace]');
}

describe('useCreateResourcePath', () => {
  beforeEach(() => jest.clearAllMocks());

  it('checks for cluster-scoped Resource templates', async () => {
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
            'spec.type': 'Resource',
          },
          facets: ['metadata.name'],
        }),
      ),
    );
  });

  it('includes the cluster namespace when cluster resource templates exist', async () => {
    mockCatalogApi.getEntityFacets.mockResolvedValue({
      facets: { 'metadata.name': [{ value: 'pg', count: 1 }] },
    });
    const { result } = renderPath();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(namespaceFilters(result.current.path)).toEqual([
      'team-ns',
      'openchoreo-cluster',
    ]);
    expect(result.current.loading).toBe(false);
  });

  it('omits the cluster namespace when there are no cluster resource templates', async () => {
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
});
