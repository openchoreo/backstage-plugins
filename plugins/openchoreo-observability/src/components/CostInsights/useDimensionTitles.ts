import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import type { CostScope, CostScopeLevel } from './types';

/**
 * Maps the raw dimension names the cost API returns (project / component /
 * environment) to their catalog `metadata.title`, so table rows read "GCP
 * Microservice Demo" instead of "gcp-microservices-demo". Names without a
 * title are simply absent from the map (callers fall back to the name).
 *
 * The dimension entity kind depends on the level: at the namespace level rows
 * are projects (System), at the project level components (Component), and at
 * the component level environments (Environment). Titles are fetched across
 * every selected scope so multi-select rows all resolve.
 */
export function useDimensionTitles(
  level: CostScopeLevel,
  scopes: CostScope[],
): Record<string, string> {
  const catalogApi = useApi(catalogApiRef);

  const namespaces = [
    ...new Set(scopes.map(s => s.namespace).filter(Boolean) as string[]),
  ].sort();
  const projectKeys =
    level === 'project'
      ? [...new Set(scopes.map(s => `${s.namespace}/${s.project}`))].sort()
      : [];

  const { data } = useOpenChoreoQuery<Record<string, string>>(
    [
      'cost-insights-dimension-titles',
      level,
      namespaces.join(','),
      projectKeys.join(','),
    ],
    async () => {
      const map: Record<string, string> = {};
      // Names can collide across namespaces/projects. If the same name resolves
      // to different titles it's ambiguous, so drop it and let the table fall
      // back to the raw name rather than pick one non-deterministically.
      const ambiguous = new Set<string>();
      const record = (name: string, title: string | undefined) => {
        if (!title) return;
        const existing = map[name];
        if (existing !== undefined && existing !== title) {
          ambiguous.add(name);
          return;
        }
        map[name] = title;
      };
      const pruneAmbiguous = () => {
        for (const name of ambiguous) delete map[name];
        return map;
      };

      if (level === 'project') {
        // Rows are components, namespace-scoped via annotations per project.
        await Promise.all(
          scopes.map(async scope => {
            const { items } = await catalogApi.getEntities({
              filter: {
                kind: 'Component',
                [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]:
                  scope.namespace!,
                [`metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`]:
                  scope.project!,
              },
              fields: [
                'metadata.name',
                'metadata.title',
                'metadata.annotations',
              ],
            });
            for (const entity of items) {
              const ann = entity.metadata.annotations ?? {};
              if (
                ann[CHOREO_ANNOTATIONS.NAMESPACE] !== scope.namespace ||
                ann[CHOREO_ANNOTATIONS.PROJECT] !== scope.project
              ) {
                continue;
              }
              record(entity.metadata.name, entity.metadata.title);
            }
          }),
        );
        return pruneAmbiguous();
      }

      // namespace level -> Systems (rows are projects); component level ->
      // Environments (rows are envs). Both are keyed by metadata.namespace.
      const kind = level === 'namespace' ? 'System' : 'Environment';
      await Promise.all(
        namespaces.map(async namespace => {
          const { items } = await catalogApi.getEntities({
            filter: { kind, 'metadata.namespace': namespace },
            fields: ['metadata.name', 'metadata.title'],
          });
          for (const entity of items) {
            record(entity.metadata.name, entity.metadata.title);
          }
        }),
      );
      return pruneAmbiguous();
    },
    { enabled: scopes.length > 0 },
  );

  return data ?? {};
}
