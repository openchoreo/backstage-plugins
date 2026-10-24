import { type ReactNode, useMemo } from 'react';
import type { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  isOpenChoreoReleaseLine,
} from '@openchoreo/backstage-plugin-common';
import { buildEntityPath } from '../../routing/pathBuilders';
import { ReleaseLineContext } from './releaseLineState';

export interface ReleaseLineProviderProps {
  entity?: Entity;
  children: ReactNode;
}

/**
 * Provides the release line of a ReleaseLine entity page, so the component
 * tabs the page reuses (build, deploy, logs, ...) work on that line.
 */
export function ReleaseLineProvider({
  entity,
  children,
}: ReleaseLineProviderProps) {
  const releaseLine =
    entity && isOpenChoreoReleaseLine(entity)
      ? entity.metadata.annotations?.[CHOREO_ANNOTATIONS.RELEASE_LINE] ??
        entity.metadata.name
      : undefined;

  const releaseLinePath =
    entity && releaseLine ? buildEntityPath(entity) : undefined;
  const value = useMemo(
    () => ({ releaseLine, releaseLinePath }),
    [releaseLine, releaseLinePath],
  );

  return (
    <ReleaseLineContext.Provider value={value}>
      {children}
    </ReleaseLineContext.Provider>
  );
}
