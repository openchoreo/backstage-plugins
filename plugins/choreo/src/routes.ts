import { createRouteRef } from '@backstage/core-plugin-api';

export const rootCatalogEnvironmentRouteRef = createRouteRef({
  id: 'environments',
});
export const rootCatalogCellDiagramRouteRef = createRouteRef({
  id: 'cell-diagram',
});
export const rootCatalogRuntimeLogsRouteRef = createRouteRef({
  id: 'runtime-logs',
});
