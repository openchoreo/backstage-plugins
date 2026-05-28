import { renderHook, act } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useProjectContentFacets } from './useProjectContentFacets';

const systemEntity = {
  kind: 'System',
  metadata: {
    name: 'url-shortener',
    annotations: { [CHOREO_ANNOTATIONS.NAMESPACE]: 'default' },
  },
} as any;

const mockCatalogApi = { getEntityFacets: jest.fn() };

function renderFacets() {
  return renderHook(() => useProjectContentFacets(systemEntity), {
    wrapper: ({ children }) => (
      <TestApiProvider apis={[[catalogApiRef, mockCatalogApi as any]]}>
        {children}
      </TestApiProvider>
    ),
  });
}

describe('useProjectContentFacets', () => {
  beforeEach(() => jest.clearAllMocks());

  it('derives per-kind counts and sorted type lists from facets', async () => {
    mockCatalogApi.getEntityFacets
      // Component facet call.
      .mockResolvedValueOnce({
        facets: {
          'spec.type': [
            { value: 'deployment/web', count: 1 },
            { value: 'deployment/service', count: 3 },
          ],
        },
      })
      // Resource facet call.
      .mockResolvedValueOnce({
        facets: { 'spec.type': [{ value: 'postgres', count: 2 }] },
      });

    const { result } = renderFacets();
    await act(async () => {});

    expect(result.current.counts).toEqual({ all: 6, component: 4, resource: 2 });
    expect(result.current.typesByKind.component).toEqual([
      'deployment/service',
      'deployment/web',
    ]);
    expect(result.current.typesByKind.resource).toEqual(['postgres']);
    expect(result.current.loading).toBe(false);
  });

  it('facets each kind by spec.type, scoped to the project', async () => {
    mockCatalogApi.getEntityFacets.mockResolvedValue({ facets: {} });
    renderFacets();
    await act(async () => {});

    expect(mockCatalogApi.getEntityFacets).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: {
          'spec.system': 'url-shortener',
          'metadata.namespace': 'default',
          kind: 'Component',
        },
        facets: ['spec.type'],
      }),
    );
    expect(mockCatalogApi.getEntityFacets).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ kind: 'Resource' }),
        facets: ['spec.type'],
      }),
    );
  });

  it('returns empty facets when the query fails', async () => {
    mockCatalogApi.getEntityFacets.mockRejectedValue(new Error('down'));
    const { result } = renderFacets();
    await act(async () => {});

    expect(result.current.counts).toEqual({ all: 0, component: 0, resource: 0 });
    expect(result.current.typesByKind).toEqual({ component: [], resource: [] });
    expect(result.current.loading).toBe(false);
  });
});
