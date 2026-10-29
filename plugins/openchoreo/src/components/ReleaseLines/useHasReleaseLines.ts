// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import type { Entity } from '@backstage/catalog-model';
import {
  hasReleaseLines,
  isOpenChoreoManagedOfKind,
} from '@openchoreo/backstage-plugin-common';
import { useReleaseLines } from './useReleaseLines';

const isOpenChoreoComponent = isOpenChoreoManagedOfKind('component');

/**
 * Whether a component has release lines besides the main line. The catalog annotation
 * answers at once, and the line list catches a line created or deleted since the
 * catalog last synced the component.
 */
export function useHasReleaseLines(entity: Entity): {
  hasLines: boolean;
  loading: boolean;
} {
  const annotated = hasReleaseLines(entity);
  const managed = isOpenChoreoComponent(entity);
  const { releaseLines, loading } = useReleaseLines(entity, {
    enabled: managed,
  });

  if (!managed) {
    return { hasLines: annotated, loading: false };
  }
  if (loading) {
    return { hasLines: annotated, loading: !annotated };
  }
  return {
    hasLines: releaseLines.some(line => !line.isMain),
    loading: false,
  };
}
