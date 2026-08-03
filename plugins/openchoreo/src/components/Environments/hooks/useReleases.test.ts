import { renderHook, waitFor, act } from '@testing-library/react';
import { Entity } from '@backstage/catalog-model';
import { createQueryWrapper } from '@openchoreo/test-utils';
import type { ComponentRelease } from '@openchoreo/backstage-plugin-common';
import { openChoreoClientApiRef } from '../../../api/OpenChoreoClientApi';
import { useReleases } from './useReleases';

const entity: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name: 'checkout', namespace: 'default' },
};

function makeRelease(
  name: string,
  creationTimestamp?: string,
): ComponentRelease {
  return {
    metadata: { name, creationTimestamp },
  } as unknown as ComponentRelease;
}

function renderUseReleases(listComponentReleases: jest.Mock) {
  const client = { listComponentReleases } as any;
  return renderHook(() => useReleases(entity), {
    wrapper: createQueryWrapper([[openChoreoClientApiRef, client]]),
  });
}

describe('useReleases', () => {
  it('starts in a loading state with no releases', () => {
    const { result } = renderUseReleases(
      jest.fn().mockReturnValue(new Promise(() => {})),
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.releases).toEqual([]);
    expect(result.current.isRefetching).toBe(false);
  });

  it('loads releases newest-first and exposes them', async () => {
    const listComponentReleases = jest.fn().mockResolvedValue({
      data: {
        items: [
          makeRelease('older', '2024-01-01T00:00:00Z'),
          makeRelease('newer', '2024-06-01T00:00:00Z'),
        ],
      },
    });
    const { result } = renderUseReleases(listComponentReleases);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.releases.map(r => r.metadata?.name)).toEqual([
      'newer',
      'older',
    ]);
    expect(result.current.error).toBeNull();
    expect(result.current.isRefetching).toBe(false);
  });

  it('surfaces a fetch failure as an error string', async () => {
    const listComponentReleases = jest
      .fn()
      .mockRejectedValue(new Error('boom'));
    const { result } = renderUseReleases(listComponentReleases);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.releases).toEqual([]);
    expect(result.current.error).toBe('boom');
  });

  it('keeps releases on screen and flips isRefetching during a background refetch', async () => {
    let releaseSecond: (v: {
      data: { items: ComponentRelease[] };
    }) => void = () => {};
    const secondPending = new Promise<{ data: { items: ComponentRelease[] } }>(
      resolve => {
        releaseSecond = resolve;
      },
    );
    const listComponentReleases = jest
      .fn()
      .mockResolvedValueOnce({ data: { items: [makeRelease('one')] } })
      .mockReturnValueOnce(secondPending);
    const { result } = renderUseReleases(listComponentReleases);

    await waitFor(() => expect(result.current.releases).toHaveLength(1));

    await act(async () => {
      result.current.refetch().catch(() => {});
    });

    await waitFor(() => expect(result.current.isRefetching).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(result.current.releases).toHaveLength(1);

    await act(async () => {
      releaseSecond({
        data: { items: [makeRelease('one'), makeRelease('two')] },
      });
      await secondPending;
    });

    await waitFor(() => expect(result.current.releases).toHaveLength(2));
    expect(result.current.isRefetching).toBe(false);
  });
});
