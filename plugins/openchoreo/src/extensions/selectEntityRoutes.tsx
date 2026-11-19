import type { Entity } from '@backstage/catalog-model';
import { EntityProvider } from '@backstage/plugin-catalog-react';
import { isOpenChoreoReleaseLine } from '@openchoreo/backstage-plugin-common';
import type { OpenChoreoRoute } from './OpenChoreoCatalogEntityPageContent';

const SCORECARDS_TAB_ID = 'entity-content:tech-insights-scorecards';

/**
 * The Overview and Definition tabs, which a ReleaseLine keeps as its own. The
 * Overview is matched by path because tabs registered without a group fall
 * into the `overview` group.
 */
const isOwnTab = (route: OpenChoreoRoute) =>
  route.path === '/' || route.group === 'definition';

/**
 * Scorecards, which scores a ReleaseLine apart from its component. It's
 * matched by extension id rather than by a filter that accepts release lines,
 * since tabs filtered on `isOpenChoreoManagedEntity` accept them too and must
 * stay with the component.
 */
const isLineTab = (route: OpenChoreoRoute) => route.id === SCORECARDS_TAB_ID;

/**
 * The tabs of an entity page.
 *
 * - A Component keeps all its tabs, which work on its main line.
 * - A ReleaseLine gets its own Overview and Definition, plus the tabs of its
 *   component, rendered for the component so they work unchanged. The
 *   `ReleaseLineProvider` of the page scopes them to the line. Scorecards
 *   keeps its place among them but renders for the line.
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
    return [...ownRoutes, ...routes.filter(isLineTab)];
  }
  const componentRoutes = routes
    .filter(
      r => !isOwnTab(r) && (isLineTab(r) || (r.if?.(componentEntity) ?? true)),
    )
    .map(r =>
      isLineTab(r)
        ? r
        : {
            ...r,
            if: undefined,
            element: (
              <EntityProvider entity={componentEntity}>
                {r.element}
              </EntityProvider>
            ),
          },
    );
  return [...ownRoutes, ...componentRoutes];
}
