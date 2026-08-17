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

/**
 * Combine an `EntityContentBlueprint`'s `filterFunction` /
 * `filterExpression` into a single predicate.
 *
 * Handles the subset the OC / upstream plugins use in practice: callable
 * functions (any shape) and simple `kind:x,y` / `type:x,y` string
 * expressions. Complex expressions (`is:`, `has:`, negation, combinations)
 * hit the fallback branch and warn once; if we see them in the wild, extend
 * this parser rather than pulling in an upstream-internal import.
 */
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

/**
 * Overrides upstream's `page:catalog/entity` with the OpenChoreo-branded
 * chrome (compact header + styled tab bar via `OpenChoreoEntityLayout`).
 *
 * This module is what makes the portal look like OpenChoreo. External
 * adopters who install `@openchoreo/backstage-plugin` and want the OC
 * chrome opt in by adding it to their `createApp({ features })` list:
 *
 * ```ts
 * import openchoreoPluginAlpha, {
 *   openChoreoEntityPageOverride,
 * } from '@openchoreo/backstage-plugin/alpha';
 * createApp({ features: [openchoreoPluginAlpha, openChoreoEntityPageOverride] });
 * ```
 *
 * Without this feature, adopters get vanilla Backstage `<EntityLayout>`
 * chrome instead — but still get all OC tabs, cards, layouts, and context
 * menu items via the plugin's regular extensions.
 *
 * Tabs come out sorted by `group` metadata against `GROUP_ORDER` below
 * (stable within a group). Ideally this override wouldn't exist at all — on
 * Backstage 1.52+, `EntityHeaderLayoutBlueprint` lets you contribute chrome
 * as a proper layout, and canonical `catalogEntityPage` handles sorting
 * (from `app.pages.entity.config.groups`) + rendering. We're pinned to
 * 1.51 which lacks that primitive, so this module bridges the gap.
 *
 * TODO(nfs-native): once Backstage is bumped to >= 1.52, replace this
 * override with an `EntityHeaderLayoutBlueprint` contributing
 * `OpenChoreoEntityLayout`. That deletes this file, deletes
 * `OpenChoreoCatalogEntityPageContent.tsx`, drops the `buildFilterFn`
 * helper, and moves tab ordering into app-config where it belongs.
 */

/**
 * Hardcoded tab-group order for the portal. Mirrors — and stays in sync
 * with — `app.pages.entity.config.groups` in `app-config.yaml`, which is
 * what adopters using canonical `<EntityLayout>` chrome (i.e. without this
 * override) see. Any tab whose `group` isn't in this list drops to the end
 * (registration order preserved among the tail).
 *
 * When we go NFS-native (see TODO above), delete this constant — the
 * canonical entity page reads groups from app-config directly.
 */
const GROUP_ORDER = [
  'overview',
  'definition',
  'deployment',
  'runtime',
  'analysis',
  'external',
] as const;
export const openChoreoEntityPageOverride = createFrontendModule({
  pluginId: 'catalog',
  extensions: [
    catalogPluginAlphaBase.getExtension('page:catalog/entity').override({
      factory(originalFactory, { inputs }) {
        // Read each content's `group` metadata alongside its route data so we
        // can group-sort the tab list before handing it to
        // `OpenChoreoEntityLayout` (which renders tabs in the order it
        // receives them, without any grouping logic of its own).
        const decorated = inputs.contents.map((output, registrationIndex) => {
          const element = output.get(coreExtensionData.reactElement);
          // Backstage wraps every blueprint-produced element in
          // `ExtensionBoundary`, whose `node` prop carries the contributing
          // extension's `AppNode`. `AppNode.spec.id` (e.g.
          // `entity-content:openchoreo/component-deploy`) is the same stable
          // string used by `app.extensions` config, so it's a natural React
          // key. Fall back to `registrationIndex` (stable within a render)
          // only if the wrapping shape ever changes.
          const nodeId =
            ((element as ReactElement).props as { node?: AppNode } | undefined)
              ?.node?.spec.id;
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

        // Group priority: index in GROUP_ORDER; unknown groups go to the end
        // (via GROUP_ORDER.length). `registrationIndex` is the stable-sort
        // tiebreaker so within a group we preserve the order plugins were
        // registered in `createPortalApp`'s `features` array.
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
