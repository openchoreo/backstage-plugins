import { renderHook, waitFor } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useEntityExistsCheck } from './useEntityExistsCheck';

function makeEntity(kind: string, name: string, annotations = {}): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: { name, namespace: 'default', annotations },
    spec: {},
  };
}

function renderUseEntityExistsCheck(entity: Entity, client: unknown) {
  return renderHook(() => useEntityExistsCheck(entity), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useEntityExistsCheck', () => {
  it('starts loading with no status', () => {
    const client = {
      getComponentDetails: jest.fn().mockReturnValue(new Promise(() => {})),
    };
    const { result } = renderUseEntityExistsCheck(
      makeEntity('Component', 'checkout'),
      client,
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.status).toBeNull();
    expect(result.current.message).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('reports "exists" for a component present in OpenChoreo', async () => {
    const client = {
      getComponentDetails: jest.fn().mockResolvedValue({ uid: 'abc-123' }),
    };
    const { result } = renderUseEntityExistsCheck(
      makeEntity('Component', 'checkout'),
      client,
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.status).toBe('exists');
    expect(result.current.message).toBeNull();
    // Background-refresh flag is exposed as `isRefetching` and settled.
    expect(result.current.isRefetching).toBe(false);
  });

  it('reports "not-found" when the component lookup 404s', async () => {
    const client = {
      getComponentDetails: jest
        .fn()
        .mockRejectedValue(new Error('404 Not Found')),
    };
    const { result } = renderUseEntityExistsCheck(
      makeEntity('Component', 'ghost'),
      client,
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.status).toBe('not-found');
    expect(result.current.message).toContain('ghost');
  });

  it('reports "marked-for-deletion" when a deletion timestamp is set', async () => {
    const client = {
      getComponentDetails: jest.fn().mockResolvedValue({
        uid: 'abc-123',
        deletionTimestamp: '2024-06-01T00:00:00Z',
      }),
    };
    const { result } = renderUseEntityExistsCheck(
      makeEntity('Component', 'checkout'),
      client,
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.status).toBe('marked-for-deletion');
    expect(result.current.message).toContain('marked for deletion');
  });

  it('assumes "exists" for unsupported entity kinds without hitting the client', async () => {
    const client = { getComponentDetails: jest.fn() };
    const { result } = renderUseEntityExistsCheck(
      makeEntity('API', 'my-api'),
      client,
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.status).toBe('exists');
    expect(result.current.message).toBeNull();
    expect(client.getComponentDetails).not.toHaveBeenCalled();
  });

  it('assumes "exists" (does not block the page) on a non-404 error', async () => {
    const client = {
      getComponentDetails: jest
        .fn()
        .mockRejectedValue(new Error('Internal Server Error')),
    };
    const { result } = renderUseEntityExistsCheck(
      makeEntity('Component', 'checkout'),
      client,
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.status).toBe('exists');
    expect(result.current.message).toBeNull();
  });

  it('exposes the background-refresh flag as false once resolved', async () => {
    // This hook returns `isRefetching` but no `refetch`, so a background refresh
    // is not caller-triggerable — assert the flag is exposed and settled false
    // after the first load (it is only ever true during a cache-driven refetch).
    const client = {
      getComponentDetails: jest.fn().mockResolvedValue({ uid: 'abc-123' }),
    };
    const { result } = renderUseEntityExistsCheck(
      makeEntity('Component', 'checkout'),
      client,
    );

    await waitFor(() => expect(result.current.status).toBe('exists'));

    expect(result.current.isRefetching).toBe(false);
  });
});
