import { createContext, useContext } from 'react';
import type { Entity } from '@backstage/catalog-model';
import { buildEntityPath } from '../../routing/pathBuilders';

/** The release line an entity page works on. */
export interface ReleaseLineContextValue {
  /** The page's release line, undefined outside a ReleaseLine entity page. */
  releaseLine?: string;
  /**
   * Catalog path of the ReleaseLine page. Its tabs render for the parent
   * component, so in-tab navigation must use this path rather than one built
   * from the component entity.
   */
  releaseLinePath?: string;
}

export const ReleaseLineContext = createContext<ReleaseLineContextValue>({});

/**
 * The release line of the current entity page. On a ReleaseLine entity page
 * every tab works on that line of its component; elsewhere it is undefined.
 */
export function useReleaseLine(): ReleaseLineContextValue {
  return useContext(ReleaseLineContext);
}

/**
 * Catalog path of the page the current tab belongs to: the ReleaseLine page
 * on a release line, otherwise the given entity's page.
 */
export function useEntityPagePath(entity: Entity): string {
  const { releaseLinePath } = useReleaseLine();
  return releaseLinePath ?? buildEntityPath(entity);
}
