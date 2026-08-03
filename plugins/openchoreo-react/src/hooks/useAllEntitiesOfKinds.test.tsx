import { renderHook, waitFor } from '@testing-library/react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { useAllEntitiesOfKinds } from './useAllEntitiesOfKinds';

// ---- Mocks ----

const mockCatalogApi = {
  getEntities: jest.fn(),
};

// ---- Helpers ----

function makeEntity(kind: string, name: string, namespace = 'default') {
  return { kind, metadata: { name, namespace } };
}

function renderWithApi(hook: () => ReturnType<typeof useAllEntitiesOfKinds>) {
  return renderHook(hook, {
    wrapper: createQueryWrapper([[catalogApiRef, mockCatalogApi as any]]),
  });
}

// ---- Tests ----

describe('useAllEntitiesOfKinds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalogApi.getEntities.mockResolvedValue({ items: [] });
  });

  it('fetches entities for given kinds', async () => {
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [makeEntity('system', 'proj-a')],
    });

    const { result } = renderWithApi(() =>
      useAllEntitiesOfKinds(['system', 'component']),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockCatalogApi.getEntities).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { kind: ['system', 'component'] },
      }),
    );
    expect(result.current.entityRefs).toHaveLength(1);
    expect(result.current.entityRefs[0]).toEqual({
      kind: 'system',
      namespace: 'default',
      name: 'proj-a',
    });
    expect(result.current.entityCount).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it('passes namespace filter when provided', async () => {
    renderWithApi(() => useAllEntitiesOfKinds(['system'], ['ns-a', 'ns-b']));

    await waitFor(() =>
      expect(mockCatalogApi.getEntities).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: {
            kind: ['system'],
            'metadata.namespace': ['ns-a', 'ns-b'],
          },
        }),
      ),
    );
  });

  it('returns empty refs and does not fetch when kinds is empty', async () => {
    const { result } = renderWithApi(() => useAllEntitiesOfKinds([]));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockCatalogApi.getEntities).not.toHaveBeenCalled();
    expect(result.current.entityRefs).toEqual([]);
    expect(result.current.entityCount).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it('sets error on fetch failure', async () => {
    mockCatalogApi.getEntities.mockRejectedValue(new Error('Catalog down'));

    const { result } = renderWithApi(() => useAllEntitiesOfKinds(['system']));

    await waitFor(() =>
      expect(result.current.error).toEqual(new Error('Catalog down')),
    );
  });

  it('defaults namespace to "default" when entity has no namespace', async () => {
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [{ kind: 'system', metadata: { name: 'proj-x' } }],
    });

    const { result } = renderWithApi(() => useAllEntitiesOfKinds(['system']));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.entityRefs[0].namespace).toBe('default');
  });

  it('refetches when kinds change', async () => {
    const { rerender } = renderHook(
      ({ kinds }) => useAllEntitiesOfKinds(kinds),
      {
        initialProps: { kinds: ['system'] },
        wrapper: createQueryWrapper([[catalogApiRef, mockCatalogApi as any]]),
      },
    );

    await waitFor(() =>
      expect(mockCatalogApi.getEntities).toHaveBeenCalledTimes(1),
    );

    rerender({ kinds: ['component'] });
    await waitFor(() =>
      expect(mockCatalogApi.getEntities).toHaveBeenCalledTimes(2),
    );

    expect(mockCatalogApi.getEntities).toHaveBeenLastCalledWith(
      expect.objectContaining({
        filter: { kind: ['component'] },
      }),
    );
  });
});
