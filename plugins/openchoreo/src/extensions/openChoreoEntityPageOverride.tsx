import type { ReactElement } from 'react';
import {
  coreExtensionData,
  createFrontendModule,
  type AppNode,
} from '@backstage/frontend-plugin-api';
import catalogPluginAlphaBase from '@backstage/plugin-catalog/alpha';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import type { Entity } from '@backstage/catalog-model';
import type { OpenChoreoRoute } from './OpenChoreoCatalogEntityPageContent';
import { sortByGroupOrder } from './entityContentGroupOrder';

// Handles callable filters + simple `kind:x,y` / `type:x,y` expressions.
// Other expression shapes warn and hide the tab.
function buildFilterFn(
  filterFunction: ((entity: Entity) => boolean) | undefined,
  filterExpression: string | undefined,
): (entity: Entity) => boolean {
  if (filterFunction) return filterFunction;
  if (!filterExpression) return () => true;
  const parts = filterExpression.split(' ').filter(Boolean);
  const matchers: Array<(e: Entity) => boolean> = [];
  for (const part of parts) {
    const m = part.match(/^(kind|type):(.+)$/);
    if (!m) {
      // eslint-disable-next-line no-console
      console.warn(
        `[openChoreoEntityPageOverride] Unsupported filter expression '${filterExpression}'; tab will be hidden. Extend buildFilterFn to support this shape.`,
      );
      return () => false;
    }
    const field = m[1] as 'kind' | 'type';
    const values = m[2].split(',').map(s => s.trim().toLowerCase());
    matchers.push(entity => {
      if (field === 'kind') return values.includes(entity.kind.toLowerCase());
      const t = (entity.spec as { type?: unknown } | undefined)?.type;
      return typeof t === 'string' && values.includes(t.toLowerCase());
    });
  }
  return entity => matchers.every(fn => fn(entity));
}

// Overrides `page:catalog/entity` with the OpenChoreo chrome
// (`OpenChoreoEntityLayout`). Adopters opt in via `createApp({ features })`.
// Mutually exclusive with `openChoreoEntityGroupsModule`.
//
// TODO(nfs-native): replace with `EntityHeaderLayoutBlueprint` once we're
// on Backstage >= 1.52; drops this file + OpenChoreoCatalogEntityPageContent.

export const openChoreoEntityPageOverride = createFrontendModule({
  pluginId: 'catalog',
  extensions: [
    catalogPluginAlphaBase.getExtension('page:catalog/entity').override({
      factory(originalFactory, { inputs }) {
        const decorated = inputs.contents.map((output, registrationIndex) => {
          const element = output.get(coreExtensionData.reactElement);
          // ExtensionBoundary wraps the element; its `node` prop carries the
          // contributing extension's AppNode id — used as the stable React key.
          const nodeId = (
            (element as ReactElement).props as { node?: AppNode } | undefined
          )?.node?.spec.id;
          const id = nodeId ?? `content-${registrationIndex}`;
          const group =
            output.get(EntityContentBlueprint.dataRefs.group) ?? 'overview';
          return {
            route: {
              id,
              path: output.get(coreExtensionData.routePath),
              title: output.get(EntityContentBlueprint.dataRefs.title),
              group,
              element,
              if: buildFilterFn(
                output.get(EntityContentBlueprint.dataRefs.filterFunction),
                output.get(EntityContentBlueprint.dataRefs.filterExpression),
              ),
            } satisfies OpenChoreoRoute,
            group,
          };
        });

        const routes: OpenChoreoRoute[] = sortByGroupOrder(
          decorated,
          d => d.group,
        ).map(d => d.route);

        return originalFactory({
          params: {
            loader: async () => {
              const { OpenChoreoCatalogEntityPageContent } = await import(
                './OpenChoreoCatalogEntityPageContent'
              );
              return <OpenChoreoCatalogEntityPageContent routes={routes} />;
            },
          },
        });
      },
    }),
  ],
});
