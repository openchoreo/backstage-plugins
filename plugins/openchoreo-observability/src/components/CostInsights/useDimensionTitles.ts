import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';
import type { CostScope, CostScopeLevel } from './types';

// The catalog kind whose entities back each level's table rows.
const KIND_BY_LEVEL: Record<CostScopeLevel, string> = {
  namespace: 'System', // rows are projects (Project = System)
  project: 'Component',
  component: 'Environment',
};

/**
 * Maps the raw dimension names the cost API returns (project / component /
 * environment) to their catalog `metadata.title`, so table rows read "GCP
 * Microservice Demo" instead of "gcp-microservices-demo". Names without a
 * title are simply absent from the map (callers fall back to the name).
 *
 * The dimension entity kind depends on the level: at the namespace level rows
 * are projects (System), at the project level components (Component), and at
 * the component level environments (Environment).
 */
export function useDimensionTitles(
  level: CostScopeLevel,
  scope: CostScope,
): Record<string, string> {
  const catalogApi = useApi(catalogApiRef);

  const { data } = useOpenChoreoQuery<Record<string, string>>(
    [
      'cost-insights-dimension-titles',
      level,
      scope.namespace ?? '',
      scope.project ?? '',
    ],
    async () => {
      const kind = KIND_BY_LEVEL[level];

      // Components are namespace-scoped via annotations, not `metadata.namespace`.
      const { items } = await catalogApi.getEntities({
        filter:
          kind === 'Component'
            ? {
                kind,
                [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]:
                  scope.namespace!,
                [`metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`]:
                  scope.project!,
              }
            : { kind, 'metadata.namespace': scope.namespace! },
        fields: ['metadata.name', 'metadata.title', 'metadata.annotations'],
      });

      const map: Record<string, string> = {};
      for (const entity of items) {
        if (kind === 'Component') {
          const ann = entity.metadata.annotations ?? {};
          if (
            ann[CHOREO_ANNOTATIONS.NAMESPACE] !== scope.namespace ||
            ann[CHOREO_ANNOTATIONS.PROJECT] !== scope.project
          ) {
            continue;
          }
        }
        if (entity.metadata.title) {
          map[entity.metadata.name] = entity.metadata.title;
        }
      }
      return map;
    },
    { enabled: Boolean(scope.namespace) },
  );

  return data ?? {};
}
