import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';

/**
 * Release line names of a component, read from the ReleaseLine entities that
 * are part of it in the catalog, with whether they have loaded. The main line is not
 * among them, and they are empty for components without release lines.
 */
export function useComponentReleaseLineState(
  namespace: string | undefined,
  component: string | undefined,
): { lines: string[]; loading: boolean } {
  const catalogApi = useApi(catalogApiRef);
  const { data = [], loading } = useOpenChoreoQuery<string[]>(
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
  return { lines: data, loading };
}

/**
 * Names of a project's components that have release lines, read from the
 * project's ReleaseLine entities in the catalog.
 */
export function useProjectReleaseLineComponents(
  namespace: string | undefined,
  project: string | undefined,
): string[] {
  const catalogApi = useApi(catalogApiRef);
  const { data = [] } = useOpenChoreoQuery<string[]>(
    ['project-release-line-components', namespace ?? '', project ?? ''],
    async () => {
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'ReleaseLine',
          'metadata.namespace': namespace!,
          [`metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`]: project!,
        },
        fields: ['metadata.annotations'],
      });
      const components = items.map(
        e => e.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT],
      );
      return Array.from(new Set(components.filter((c): c is string => !!c)));
    },
    { enabled: Boolean(namespace && project) },
  );
  return data;
}

/** Release line names of a component, as {@link useComponentReleaseLineState}. */
export function useComponentReleaseLines(
  namespace: string | undefined,
  component: string | undefined,
): string[] {
  return useComponentReleaseLineState(namespace, component).lines;
}
