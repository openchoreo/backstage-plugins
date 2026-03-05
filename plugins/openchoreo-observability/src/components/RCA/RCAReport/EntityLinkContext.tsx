import { createContext, useContext } from 'react';

/** Provides the OpenChoreo namespace so entity tags can be rendered as catalog links */
export const EntityLinkContext = createContext<{ namespace: string }>({
  namespace: 'default',
});

export const useEntityLinkContext = () => useContext(EntityLinkContext);
