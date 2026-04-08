import { renderHook, waitFor } from '@testing-library/react';
import { useProjects } from './useProjects';

const mockGetEntities = jest.fn();
const mockCatalogApi = { getEntities: mockGetEntities };

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useApi: () => mockCatalogApi,
}));

jest.mock('@backstage/plugin-catalog-react', () => ({
  catalogApiRef: { id: 'catalog' },
}));

describe('useProjects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches all projects when namespaces is undefined', async () => {
    mockGetEntities.mockResolvedValue({
      items: [
        { metadata: { name: 'p1', namespace: 'ns1' } },
        { metadata: { name: 'p2', namespace: 'ns2' } },
      ],
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => expect(result.current.length).toBe(2));
    expect(mockGetEntities).toHaveBeenCalledWith({
      filter: { kind: 'System' },
      fields: ['metadata.name', 'metadata.namespace'],
    });
  });

  it('filters by namespaces when provided', async () => {
    mockGetEntities.mockResolvedValue({
      items: [{ metadata: { name: 'p1', namespace: 'ns1' } }],
    });

    renderHook(() => useProjects(['ns1', 'ns2']));

    await waitFor(() =>
      expect(mockGetEntities).toHaveBeenCalledWith({
        filter: { kind: 'System', 'metadata.namespace': ['ns1', 'ns2'] },
        fields: ['metadata.name', 'metadata.namespace'],
      }),
    );
  });

  it('returns empty array when namespaces is an empty array', async () => {
    const { result } = renderHook(() => useProjects([]));
    // Should not call API
    expect(mockGetEntities).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('sorts projects by namespace, then name', async () => {
    mockGetEntities.mockResolvedValue({
      items: [
        { metadata: { name: 'zebra', namespace: 'ns1' } },
        { metadata: { name: 'apple', namespace: 'ns2' } },
        { metadata: { name: 'banana', namespace: 'ns1' } },
      ],
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => expect(result.current.length).toBe(3));
    expect(result.current).toEqual([
      { name: 'banana', namespace: 'ns1' },
      { name: 'zebra', namespace: 'ns1' },
      { name: 'apple', namespace: 'ns2' },
    ]);
  });

  it('returns empty array on API error', async () => {
    mockGetEntities.mockRejectedValue(new Error('API fail'));
    const { result } = renderHook(() => useProjects());
    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });

  it('defaults namespace to "default" when missing from entity', async () => {
    mockGetEntities.mockResolvedValue({
      items: [{ metadata: { name: 'p1' } }],
    });

    const { result } = renderHook(() => useProjects());

    await waitFor(() => expect(result.current.length).toBe(1));
    expect(result.current[0].namespace).toBe('default');
  });
});
