// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import type { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  CHOREO_ANNOTATIONS,
  isOpenChoreoManagedOfKind,
} from '@openchoreo/backstage-plugin-common';
import { useOpenChoreoQuery } from '@openchoreo/backstage-plugin-react';

const isOpenChoreoComponent = isOpenChoreoManagedOfKind('component');

/**
 * Catalog ref of a component's ComponentType or ClusterComponentType. The
 * type annotation reads `{workloadType}/{name}`.
 */
export function componentTypeEntityRef(entity: Entity): string | undefined {
  const annotations = entity.metadata.annotations ?? {};
  const typeName = annotations[CHOREO_ANNOTATIONS.COMPONENT_TYPE]
    ?.split('/')
    .pop();
  if (!typeName) return undefined;
  return annotations[CHOREO_ANNOTATIONS.COMPONENT_TYPE_KIND] ===
    'ClusterComponentType'
    ? `clustercomponenttype:openchoreo-cluster/${typeName}`
    : `componenttype:${entity.metadata.namespace ?? 'default'}/${typeName}`;
}

/**
 * Whether a component can have release lines besides the default line, from its type's
 * `releaseLines` (`Allowed` or `Disallowed`, default `Disallowed`).
 */
export function useReleaseLinesAllowed(entity: Entity): {
  allowed: boolean;
  loading: boolean;
} {
  const catalogApi = useApi(catalogApiRef);
  const typeRef = isOpenChoreoComponent(entity)
    ? componentTypeEntityRef(entity)
    : undefined;

  const { data, loading } = useOpenChoreoQuery<boolean>(
    ['release-lines-allowed', typeRef ?? ''],
    async () => {
      const type = await catalogApi.getEntityByRef(typeRef!);
      return (
        (type?.spec as { releaseLines?: string } | undefined)?.releaseLines ===
        'Allowed'
      );
    },
    { enabled: Boolean(typeRef) },
  );

  return { allowed: data ?? false, loading: Boolean(typeRef) && loading };
}
