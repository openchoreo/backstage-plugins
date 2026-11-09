import { useRouteRef } from '@backstage/core-plugin-api';
import { entityRouteRef } from '@backstage/plugin-catalog-react';
import { getCompoundEntityRef, type Entity } from '@backstage/catalog-model';
import { DEFAULT_ENTITY_TAB_PATH } from '../routes';

/**
 * Links to an entity's scorecard tab, or with `toTab: false` to its page.
 * The tab exists only for the kinds in the host's entity-content filter,
 * which the plugin can't see, so an entity with no scores links to its page:
 * a rollup can reach kinds, such as OpenChoreo's Environments, that have no
 * tab, and there would be nothing on it anyway.
 */
export function useEntityTabLink(): (
  entity: Entity,
  options?: { toTab?: boolean },
) => string {
  const entityRoute = useRouteRef(entityRouteRef);
  return (entity, { toTab = true } = {}) => {
    const ref = getCompoundEntityRef(entity);
    const page = entityRoute({
      kind: ref.kind.toLocaleLowerCase('en-US'),
      namespace: ref.namespace,
      name: ref.name,
    });
    return toTab ? `${page}${DEFAULT_ENTITY_TAB_PATH}` : page;
  };
}
