import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';

/**
 * Release line names of a component, read from the ReleaseLine entities that
 * are part of it in the catalog. Empty for components without release lines.
 */
export function useComponentReleaseLines(
  namespace: string | undefined,
  component: string | undefined,
): string[] {
  const catalogApi = useApi(catalogApiRef);
  const { data = [] } = useOpenChoreoQuery<string[]>(
    ['insights-release-lines', namespace ?? '', component ?? ''],
    async () => {
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'ReleaseLine',
          'metadata.namespace': namespace!,
          'relations.partof': `component:${namespace}/${component}`,
        },
        fields: ['metadata.name', 'metadata.annotations'],
      });
      return items
        .map(
          e =>
            e.metadata.annotations?.[CHOREO_ANNOTATIONS.RELEASE_LINE] ??
            e.metadata.name,
        )
        .sort((a, b) => a.localeCompare(b));
    },
    { enabled: Boolean(namespace && component) },
  );
  return data;
}
