import { useApi, discoveryApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  CHOREO_ANNOTATIONS,
  mergeOverrides,
} from '@openchoreo/backstage-plugin-common';
import {
  fetchReleaseLineResource,
  openChoreoFetchApiRef,
  useOpenChoreoQuery,
  useReleaseLine,
} from '@openchoreo/backstage-plugin-react';

/**
 * The workflow parameters a build uses: the component's, with the current
 * release line's build overrides applied on a release line page.
 */
export function useReleaseLineWorkflowParameters(
  parameters: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const { entity } = useEntity();
  const { releaseLine } = useReleaseLine();
  const discoveryApi = useApi(discoveryApiRef);
  const fetchApi = useApi(openChoreoFetchApiRef);

  const namespaceName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';
  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT] ??
    entity.metadata.name;

  const { data: line } = useOpenChoreoQuery(
    ['release-line-resource', namespaceName, componentName, releaseLine ?? ''],
    () =>
      fetchReleaseLineResource(discoveryApi, fetchApi, {
        namespaceName,
        componentName,
        releaseLineName: releaseLine!,
      }),
    { enabled: Boolean(releaseLine) },
  );

  if (!releaseLine) {
    return parameters;
  }
  return mergeOverrides(parameters, line?.spec?.workflow?.parameters);
}
