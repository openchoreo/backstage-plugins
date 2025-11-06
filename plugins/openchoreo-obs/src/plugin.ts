import {
  createPlugin,
  createRoutableExtension,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';
import { observabilityApiRef, ObservabilityClient } from './api/ObservabilityApi';

export const openchoreoObsPlugin = createPlugin({
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

export const OpenchoreoObsPage = openchoreoObsPlugin.provide(
  createRoutableExtension({
    name: 'OpenchoreoObsPage',
    component: () =>
      import('./components/ObservabilityMetricsPage').then(m => m.ObservabilityMetricsPage),
    mountPoint: rootRouteRef,
  }),
);

export const MetricsContent = openchoreoObsPlugin.provide(
  createRoutableExtension({
    name: 'MetricsContent',
    component: () =>
      import('./components/MetricsContent').then(m => m.MetricsContent),
    mountPoint: rootRouteRef,
  }),
);
