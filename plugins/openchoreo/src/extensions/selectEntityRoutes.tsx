import type { Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { isOpenChoreoReleaseLine } from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoRoute } from './OpenChoreoCatalogEntityPageContent';

/**
 * The Overview and Definition tabs, which a ReleaseLine keeps as its own. The
 * Overview is matched by path because tabs registered without a group fall
 * into the `overview` group.
 */
const isOwnTab = (route: OpenChoreoRoute) =>
  route.path === '/' || route.group === 'definition';

/**
 * The tabs of an entity page.
 *
 * - A Component keeps all its tabs, which work on its main line.
 * - A ReleaseLine gets its own Overview and Definition, plus the tabs of its
 *   component, rendered for the component so they work unchanged. The
 *   `ReleaseLineProvider` of the page scopes them to the line.
 */
export function selectEntityRoutes(
  routes: OpenChoreoRoute[],
  entity: Entity,
  componentEntity?: Entity,
): OpenChoreoRoute[] {
  if (!isOpenChoreoReleaseLine(entity)) {
    return routes;
  }

  const ownRoutes = routes.filter(isOwnTab);
  if (!componentEntity) {
    return ownRoutes;
  }
  const componentRoutes = routes
    .filter(r => !isOwnTab(r) && (r.if?.(componentEntity) ?? true))
    .map(r => ({
      ...r,
      if: undefined,
      element: (
        <EntityProvider entity={componentEntity}>{r.element}</EntityProvider>
      ),
    }));
  return [...ownRoutes, ...componentRoutes];
}
