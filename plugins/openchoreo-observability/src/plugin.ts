import { lazy } from 'react';
import {
  createPlugin,
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
import { finopsAgentApiRef, FinOpsAgentClient } from './api/FinOpsAgentApi';

export const openchoreoObservabilityPlugin = createPlugin({
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
    createApiFactory({
      api: finopsAgentApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new FinOpsAgentClient({ discoveryApi, fetchApi }),
    }),
  ],
});

/**
 * Entity-page tab components. Previously wrapped in
 * `createRoutableExtension({ mountPoint: rootRouteRef })`, but `rootRouteRef`
 * is never bound to a real mounted path — these are tab content, not
 * standalone pages, so the routable wrapper would throw
 * "Routable extension component was not discovered in the app element tree"
 * at render time. Exported as `React.lazy` components so the page bundle
 * still code-splits.
 */
export const ObservabilityMetrics = lazy(() =>
  import('./components/Metrics/ObservabilityMetricsPage').then(m => ({
    default: m.ObservabilityMetricsPage,
  })),
);

export const ObservabilityTraces = lazy(() =>
  import('./components/Traces/ObservabilityTracesPage').then(m => ({
    default: m.ObservabilityTracesPage,
  })),
);

export const ObservabilityRCA = lazy(() =>
  import('./components/RCA/RCAPage').then(m => ({ default: m.RCAPage })),
);

export const ObservabilityRuntimeLogs = lazy(() =>
  import('./components/RuntimeLogs/ObservabilityRuntimeLogsPage').then(m => ({
    default: m.ObservabilityRuntimeLogsPage,
  })),
);

export const ObservabilityRuntimeEvents = lazy(() =>
  import('./components/RuntimeEvents/ObservabilityRuntimeEventsPage').then(
    m => ({ default: m.ObservabilityRuntimeEventsPage }),
  ),
);

export const ObservabilityProjectRuntimeLogs = lazy(() =>
  import('./components/RuntimeLogs/ObservabilityProjectRuntimeLogsPage').then(
    m => ({ default: m.ObservabilityProjectRuntimeLogsPage }),
  ),
);

export const ObservabilityAlerts = lazy(() =>
  import('./components/Alerts/ObservabilityAlertsPage').then(m => ({
    default: m.ObservabilityAlertsPage,
  })),
);

export const ObservabilityWirelogs = lazy(() =>
  import('./components/Wirelogs/ObservabilityWirelogsPage').then(m => ({
    default: m.ObservabilityWirelogsPage,
  })),
);

export const ObservabilityProjectIncidents = lazy(() =>
  import('./components/Incidents/ObservabilityProjectIncidentsPage').then(
    m => ({ default: m.ObservabilityProjectIncidentsPage }),
  ),
);

export const ObservabilityCostAnalysis = lazy(() =>
  import('./components/CostAnalysis').then(m => ({
    default: m.CostAnalysisPage,
  })),
);
