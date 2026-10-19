import type { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { isOpenChoreoReleaseLine } from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '../../hooks/useOpenChoreoQuery';

export interface ReleaseLineComponentEntity {
  /** The component the release line belongs to, once loaded. */
  componentEntity?: Entity;
  loading: boolean;
  error?: Error | null;
}

/**
 * Loads the component a ReleaseLine entity belongs to (`spec.component`).
 * Returns nothing for any other entity.
 */
export function useReleaseLineComponentEntity(
  entity?: Entity,
): ReleaseLineComponentEntity {
  const catalogApi = useApi(catalogApiRef);
  const componentRef =
    entity && isOpenChoreoReleaseLine(entity)
      ? (entity.spec?.component as string | undefined)
      : undefined;

  const { data, loading, error } = useOpenChoreoQuery<Entity | null>(
    ['release-line-component', componentRef ?? ''],
    async () => (await catalogApi.getEntityByRef(componentRef!)) ?? null,
    { enabled: Boolean(componentRef) },
  );

  return {
    componentEntity: data ?? undefined,
    loading: Boolean(componentRef) && loading,
    error,
  };
}
