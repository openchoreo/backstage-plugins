import { createRouteRef } from '@backstage/core-plugin-api';

export const rootCatalogEnvironmentRouteRef = createRouteRef({
  id: 'deploy',
});
export const rootCatalogCellDiagramRouteRef = createRouteRef({
  id: 'cell-diagram',
});
export const rootCatalogRuntimeLogsRouteRef = createRouteRef({
  id: 'runtime-logs',
});
export const rootCatalogTraitsRouteRef = createRouteRef({
  id: 'traits',
});
export const accessControlRouteRef = createRouteRef({
  id: 'access-control',
});
