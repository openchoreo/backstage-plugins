// Copyright 2026 The OpenChoreo Authors
// SPDX-License-Identifier: Apache-2.0

import type { Entity } from '@backstage/catalog-model';
import { hasReleaseLines } from '@openchoreo/backstage-plugin-common';
import { useReleaseLines } from './useReleaseLines';
import { useReleaseLinesAllowed } from './useReleaseLinesAllowed';

/**
 * Whether a component has release lines besides the default line. The catalog annotation
 * answers at once, and for a type that allows lines the line list catches a
 * line created or deleted since the catalog last synced the component.
 */
export function useHasReleaseLines(entity: Entity): {
  hasLines: boolean;
  loading: boolean;
} {
  const annotated = hasReleaseLines(entity);
  const { allowed, loading: allowedLoading } = useReleaseLinesAllowed(entity);
  const { releaseLines, loading } = useReleaseLines(entity, {
    enabled: allowed,
  });

  if (!allowed) {
    return { hasLines: annotated, loading: allowedLoading };
  }
  if (loading) {
    return { hasLines: annotated, loading: !annotated };
  }
  return {
    hasLines: releaseLines.some(line => !line.isDefault),
    loading: false,
  };
}
