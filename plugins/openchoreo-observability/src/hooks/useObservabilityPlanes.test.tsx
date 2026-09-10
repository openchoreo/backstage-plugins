import { renderHook, waitFor } from '@testing-library/react';
import { createQueryWrapper } from '@openchoreo/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useObservabilityPlanes } from './useObservabilityPlanes';

const plane = (
  kind: string,
  name: string,
  namespace = 'default',
  title?: string,
) => ({
  apiVersion: 'openchoreo.dev/v1alpha1',
  kind,
  metadata: {
    name,
    namespace,
    ...(title ? { title } : {}),
    annotations: { [CHOREO_ANNOTATIONS.OBSERVER_URL]: `https://${name}` },
  },
});

const mockCatalogApi = { getEntities: jest.fn() };

/** The hook queries the two kinds separately, in that order. */
function givenPlanes(namespaced: unknown[], clusterScoped: unknown[]) {
  mockCatalogApi.getEntities
    .mockResolvedValueOnce({ items: namespaced })
    .mockResolvedValueOnce({ items: clusterScoped });
}

function setup() {
  return renderHook(() => useObservabilityPlanes(), {
    wrapper: createQueryWrapper([[catalogApiRef, mockCatalogApi as any]]),
  });
}

beforeEach(() => jest.clearAllMocks());

describe('useObservabilityPlanes', () => {
  it('identifies a plane by its full entity ref', async () => {
    givenPlanes([plane('ObservabilityPlane', 'main', 'default', 'Main')], []);

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.planes).toEqual([
      {
        ref: 'observabilityplane:default/main',
        displayName: 'Main',
        kind: 'ObservabilityPlane',
        namespace: 'default',
        observerUrl: 'https://main',
      },
    ]);
  });

  // Two kinds are listed together, so a bare metadata.name is not unique. A duplicate
  // would resolve to whichever came back first and leave the other unreachable from
  // both the picker and a permalink.
  it('keeps same-named planes distinct across kinds and namespaces', async () => {
    givenPlanes(
      [
        plane('ObservabilityPlane', 'default', 'default'),
        plane('ObservabilityPlane', 'default', 'other'),
      ],
      [plane('ClusterObservabilityPlane', 'default')],
    );

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    const refs = result.current.planes.map(p => p.ref);
    expect(new Set(refs).size).toBe(3);
    expect(refs).toEqual(
      expect.arrayContaining([
        'observabilityplane:default/default',
        'observabilityplane:other/default',
        'clusterobservabilityplane:default/default',
      ]),
    );
  });

  it('falls back to the entity name when there is no title', async () => {
    givenPlanes([plane('ObservabilityPlane', 'main')], []);

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.planes[0].displayName).toBe('main');
  });

  // The picker labels same-named planes by these, so they have to survive the mapping.
  it('carries the kind and namespace the picker labels planes by', async () => {
    givenPlanes(
      [plane('ObservabilityPlane', 'default', 'team-a')],
      [plane('ClusterObservabilityPlane', 'default')],
    );

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(
      result.current.planes.map(p => [p.kind, p.namespace]),
    ).toEqual(
      expect.arrayContaining([
        ['ObservabilityPlane', 'team-a'],
        ['ClusterObservabilityPlane', 'default'],
      ]),
    );
  });

  // Two planes named "default" would otherwise order by catalog response order, so the
  // picker could swap its rows between loads.
  it('orders same-named planes stably', async () => {
    givenPlanes(
      [plane('ObservabilityPlane', 'default')],
      [plane('ClusterObservabilityPlane', 'default')],
    );

    const { result } = setup();
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.planes.map(p => p.ref)).toEqual([
      'clusterobservabilityplane:default/default',
      'observabilityplane:default/default',
    ]);
  });
});
