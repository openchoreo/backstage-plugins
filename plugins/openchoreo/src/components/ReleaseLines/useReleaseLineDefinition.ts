import { useMemo } from 'react';
import { useApi } from '@backstage/core-plugin-api';
import { stringifyEntityRef, type Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  type ReleaseLineResource,
} from '@openchoreo/backstage-plugin-common';
import {
  useOpenChoreoMutation,
  useOpenChoreoQuery,
  useReleaseLineComponentEntity,
} from '@openchoreo/backstage-plugin-react';
import { openChoreoClientApiRef } from '../../api/OpenChoreoClientApi';
import {
  pickOverridableProperties,
  toEditableReleaseLine,
} from './releaseLineUtils';

/**
 * A release line, editable as YAML, and the component properties it inherits,
 * with a save that replaces the release line.
 */
export function useReleaseLineDefinition(entity: Entity) {
  const client = useApi(openChoreoClientApiRef);
  const releaseLineName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.RELEASE_LINE] ??
    entity.metadata.name;
  const componentName =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.COMPONENT] ?? '';
  const namespace =
    entity.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE] ?? '';

  const { componentEntity } = useReleaseLineComponentEntity(entity);

  const releaseLineKey = ['release-line', stringifyEntityRef(entity)];
  const releaseLineQuery = useOpenChoreoQuery<ReleaseLineResource>(
    releaseLineKey,
    () => client.fetchReleaseLine(entity, releaseLineName),
  );

  const componentQuery = useOpenChoreoQuery<Record<string, unknown>>(
    ['resource-definition', 'components', namespace, componentName],
    () => client.getResourceDefinition('components', namespace, componentName),
    { enabled: Boolean(namespace && componentName) },
  );

  const { mutate: save, isLoading: isSaving } = useOpenChoreoMutation(
    (releaseLine: ReleaseLineResource) =>
      client.replaceReleaseLine(entity, releaseLine),
    { invalidates: [releaseLineKey] },
  );

  const editable = useMemo(
    () =>
      releaseLineQuery.data
        ? toEditableReleaseLine(releaseLineQuery.data)
        : undefined,
    [releaseLineQuery.data],
  );
  const inherited = useMemo(
    () =>
      pickOverridableProperties(
        componentQuery.data?.spec as Record<string, unknown> | undefined,
      ),
    [componentQuery.data],
  );

  return {
    releaseLineName,
    componentName,
    componentEntity,
    releaseLine: releaseLineQuery.data,
    editable,
    inherited: componentQuery.data ? inherited : undefined,
    loading: releaseLineQuery.loading,
    inheritedLoading: componentQuery.loading,
    error: releaseLineQuery.error,
    inheritedError: componentQuery.error,
    refresh: releaseLineQuery.refetch,
    save,
    isSaving,
  };
}
