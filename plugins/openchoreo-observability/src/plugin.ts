import {
  createPlugin,
  createRoutableExtension,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';
import {
  observabilityApiRef,
  ObservabilityClient,
} from './api/ObservabilityApi';
import { rcaAgentApiRef, RCAAgentClient } from './api/RCAAgentApi';

const openchoreoObservabilityPlugin = createPlugin({
  id: 'openchoreo-observability',
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
    createApiFactory({
      api: rcaAgentApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new RCAAgentClient({ discoveryApi, fetchApi }),
    }),
  ],
});

export const ObservabilityMetrics = openchoreoObservabilityPlugin.provide(
  createRoutableExtension({
    name: 'ObservabilityMetrics',
    component: () =>
      import('./components/Metrics/ObservabilityMetricsPage').then(
        m => m.ObservabilityMetricsPage,
      ),
    mountPoint: rootRouteRef,
  }),
);

export const ObservabilityTraces = openchoreoObservabilityPlugin.provide(
  createRoutableExtension({
    name: 'ObservabilityTraces',
    component: () =>
      import('./components/Traces/ObservabilityTracesPage').then(
        m => m.ObservabilityTracesPage,
      ),
    mountPoint: rootRouteRef,
  }),
);

export const ObservabilityRCA = openchoreoObservabilityPlugin.provide(
  createRoutableExtension({
    name: 'ObservabilityRCA',
    component: () => import('./components/RCA/RCAPage').then(m => m.RCAPage),
    mountPoint: rootRouteRef,
  }),
);

export const ObservabilityRuntimeLogs = openchoreoObservabilityPlugin.provide(
  createRoutableExtension({
    name: 'ObservabilityRuntimeLogs',
    component: () =>
      import('./components/RuntimeLogs/ObservabilityRuntimeLogsPage').then(
        m => m.ObservabilityRuntimeLogsPage,
      ),
    mountPoint: rootRouteRef,
  }),
);
