import { createContext, useContext } from 'react';
import type { EntityMap } from '../../../hooks/useEntitiesByUids';

export const EntityLinkContext = createContext<{
  entityMap: EntityMap;
  loading: boolean;
}>({
  entityMap: new Map(),
  loading: false,
});

export const useEntityLinkContext = () => useContext(EntityLinkContext);
