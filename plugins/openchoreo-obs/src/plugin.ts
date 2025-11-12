import {
  createPlugin,
  createRoutableExtension,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';
import { observabilityApiRef, ObservabilityClient } from './api/ObservabilityApi';

const openchoreoObsPlugin = createPlugin({
  id: 'openchoreo-obs',
  routes: {
    root: rootRouteRef,
  },
  apis: [
    createApiFactory({
      api: observabilityApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new ObservabilityClient({ discoveryApi, fetchApi }),
    }),
  ],
});

export const ObservabilityMetrics = openchoreoObsPlugin.provide(
  createRoutableExtension({
    name: 'ObservabilityMetrics',
    component: () =>
      import('./components/Metrics/ObservabilityMetricsPage').then(m => m.ObservabilityMetricsPage),
    mountPoint: rootRouteRef,
  }),
);
