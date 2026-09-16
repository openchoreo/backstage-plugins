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

// Tab-group order for the flat tab bar. Tabs whose `group` is missing here
// fall to the end in registration order.
const GROUP_ORDER = [
  'overview',
  'documentation',
  'definition',
  'api-try-out',
  'development',
  'build',
  'deploy',
  'cell-diagram',
  'diagram',
  'logs',
  'events',
  'metrics',
  'alerts',
  'wirelogs',
  'traces',
  'incidents',
  'rca-reports',
  'cost-analysis',
  'deployment',
  'operation',
  'observability',
  'external',
] as const;
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
          return {
            route: {
              id,
              path: output.get(coreExtensionData.routePath),
              title: output.get(EntityContentBlueprint.dataRefs.title),
              element,
              if: buildFilterFn(
                output.get(EntityContentBlueprint.dataRefs.filterFunction),
                output.get(EntityContentBlueprint.dataRefs.filterExpression),
              ),
            } satisfies OpenChoreoRoute,
            group:
              output.get(EntityContentBlueprint.dataRefs.group) ?? 'overview',
            registrationIndex,
          };
        });

        // Sort by GROUP_ORDER (unknown → end), tie-break on registration order.
        const groupPriority = (group: string) => {
          const i = (GROUP_ORDER as readonly string[]).indexOf(group);
          return i === -1 ? GROUP_ORDER.length : i;
        };
        decorated.sort((a, b) => {
          const gp = groupPriority(a.group) - groupPriority(b.group);
          if (gp !== 0) return gp;
          return a.registrationIndex - b.registrationIndex;
        });

        const routes: OpenChoreoRoute[] = decorated.map(d => d.route);

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
