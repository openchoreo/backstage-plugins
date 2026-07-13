import {
  ApiBlueprint,
  createExtensionInput,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PluginWrapperBlueprint,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { FeatureGatedContent } from '@openchoreo/backstage-plugin-react';

import { rootRouteRef } from './routes';
import {
  observabilityApiRef,
  ObservabilityClient,
} from './api/ObservabilityApi';
import { rcaAgentApiRef, RCAAgentClient } from './api/RCAAgentApi';
import { finopsAgentApiRef, FinOpsAgentClient } from './api/FinOpsAgentApi';
import {
  DefaultLogRowActionRendererApi,
  logRowActionRendererApiRef,
} from './api/LogRowActionRendererApi';
import { LogRowActionBlueprint } from './alpha/LogRowActionBlueprint';

export { LogRowActionBlueprint } from './alpha/LogRowActionBlueprint';
export {
  logRowActionRendererApiRef,
  type LogRowActionRendererApi,
} from './api/LogRowActionRendererApi';

const observabilityApi = ApiBlueprint.make({
  name: 'observability',
  params: defineParams =>
    defineParams({
      api: observabilityApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new ObservabilityClient({ discoveryApi, fetchApi }),
    }),
});

// Wraps this plugin's own extensions in the TanStack Query provider (see the
// openchoreo plugin's alpha for the full rationale). Shares the one `queryClient`
// singleton across all OpenChoreo plugins.
const queryProvider = PluginWrapperBlueprint.make({
  name: 'query-provider',
  params: defineParams =>
    defineParams({
      loader: async () => {
        const { OpenChoreoQueryProvider } = await import(
          '@openchoreo/backstage-plugin-react'
        );
        return { component: OpenChoreoQueryProvider };
      },
    }),
});

const rcaAgentApi = ApiBlueprint.make({
  name: 'rca-agent',
  params: defineParams =>
    defineParams({
      api: rcaAgentApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new RCAAgentClient({ discoveryApi, fetchApi }),
    }),
});

const finopsAgentApi = ApiBlueprint.make({
  name: 'finops-agent',
  params: defineParams =>
    defineParams({
      api: finopsAgentApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new FinOpsAgentClient({ discoveryApi, fetchApi }),
    }),
});

/**
 * Registry API for host-injected log-row action renderers. Collects every
 * `LogRowActionBlueprint` extension contributed by the host (or any other
 * plugin) and exposes the first renderer via `useApi(logRowActionRendererApiRef)`.
 *
 * Mirrors upstream's `formDecoratorsApi` (plugin-scaffolder) — see
 * `node_modules/@backstage/plugin-scaffolder/dist/alpha/api/FormDecoratorsApi.esm.js`.
 */
const logRowActionRendererApi = ApiBlueprint.makeWithOverrides({
  name: 'log-row-action-renderer',
  inputs: {
    renderers: createExtensionInput([LogRowActionBlueprint.dataRefs.renderer]),
  },
  factory(originalFactory, { inputs }) {
    const renderers = inputs.renderers.map(e =>
      e.get(LogRowActionBlueprint.dataRefs.renderer),
    );
    return originalFactory(defineParams =>
      defineParams({
        api: logRowActionRendererApiRef,
        deps: {},
        factory: () => DefaultLogRowActionRendererApi.create({ renderers }),
      }),
    );
  },
});

/**
 * Component-page entity tabs (kind:component). Each tab loads its page
 * component lazily and wraps it in `FeatureGatedContent feature="observability"`
 * so the tab is in-tree (so routing stays valid) but renders an
 * empty-state when the host has observability disabled.
 *
 * The runtime-logs tab does NOT pass a `renderRowAction` prop — the page
 * component reads the host-registered renderer through
 * `useApiHolder().get(logRowActionRendererApiRef)` (see Step 1).
 */
const runtimeLogsEntityContent = EntityContentBlueprint.make({
  name: 'runtime-logs',
  params: {
    path: '/runtime-logs',
    title: 'Logs',
    filter: 'kind:component',
    loader: () =>
      import('./components/RuntimeLogs/ObservabilityRuntimeLogsPage').then(
        m => (
          <FeatureGatedContent feature="observability">
            <m.ObservabilityRuntimeLogsPage />
          </FeatureGatedContent>
        ),
      ),
  },
});

const runtimeEventsEntityContent = EntityContentBlueprint.make({
  name: 'runtime-events',
  params: {
    path: '/runtime-events',
    title: 'Events',
    filter: 'kind:component',
    loader: () =>
      import('./components/RuntimeEvents/ObservabilityRuntimeEventsPage').then(
        m => (
          <FeatureGatedContent feature="observability">
            <m.ObservabilityRuntimeEventsPage />
          </FeatureGatedContent>
        ),
      ),
  },
});

const metricsEntityContent = EntityContentBlueprint.make({
  name: 'metrics',
  params: {
    path: '/metrics',
    title: 'Metrics',
    filter: 'kind:component',
    loader: () =>
      import('./components/Metrics/ObservabilityMetricsPage').then(m => (
        <FeatureGatedContent feature="observability">
          <m.ObservabilityMetricsPage />
        </FeatureGatedContent>
      )),
  },
});

const alertsEntityContent = EntityContentBlueprint.make({
  name: 'alerts',
  params: {
    path: '/alerts',
    title: 'Alerts',
    filter: 'kind:component',
    loader: () =>
      import('./components/Alerts/ObservabilityAlertsPage').then(m => (
        <FeatureGatedContent feature="observability">
          <m.ObservabilityAlertsPage />
        </FeatureGatedContent>
      )),
  },
});

const wirelogsEntityContent = EntityContentBlueprint.make({
  name: 'wirelogs',
  params: {
    path: '/wirelogs',
    title: 'Wirelogs',
    filter: 'kind:component',
    loader: () =>
      import('./components/Wirelogs/ObservabilityWirelogsPage').then(m => (
        <FeatureGatedContent feature="observability">
          <m.ObservabilityWirelogsPage />
        </FeatureGatedContent>
      )),
  },
});

/**
 * System-page (Project) entity tabs (kind:system). Same gating pattern
 * as component-page tabs: lazy load + observability feature gate. The
 * `/logs` tab uses `ObservabilityProjectRuntimeLogsPage` rather than the
 * component-scoped runtime-logs page.
 */
const projectRuntimeLogsEntityContent = EntityContentBlueprint.make({
  name: 'project-runtime-logs',
  params: {
    path: '/logs',
    title: 'Logs',
    filter: 'kind:system',
    loader: () =>
      import(
        './components/RuntimeLogs/ObservabilityProjectRuntimeLogsPage'
      ).then(m => (
        <FeatureGatedContent feature="observability">
          <m.ObservabilityProjectRuntimeLogsPage />
        </FeatureGatedContent>
      )),
  },
});

const tracesEntityContent = EntityContentBlueprint.make({
  name: 'traces',
  params: {
    path: '/traces',
    title: 'Traces',
    filter: 'kind:system',
    loader: () =>
      import('./components/Traces/ObservabilityTracesPage').then(m => (
        <FeatureGatedContent feature="observability">
          <m.ObservabilityTracesPage />
        </FeatureGatedContent>
      )),
  },
});

const projectIncidentsEntityContent = EntityContentBlueprint.make({
  name: 'project-incidents',
  params: {
    path: '/incidents',
    title: 'Incidents',
    filter: 'kind:system',
    loader: () =>
      import('./components/Incidents/ObservabilityProjectIncidentsPage').then(
        m => (
          <FeatureGatedContent feature="observability">
            <m.ObservabilityProjectIncidentsPage />
          </FeatureGatedContent>
        ),
      ),
  },
});

const rcaReportsEntityContent = EntityContentBlueprint.make({
  name: 'rca-reports',
  params: {
    path: '/rca-reports',
    title: 'RCA Reports',
    filter: 'kind:system',
    loader: () =>
      import('./components/RCA/RCAPage').then(m => (
        <FeatureGatedContent feature="observability">
          <m.RCAPage />
        </FeatureGatedContent>
      )),
  },
});

const costAnalysisEntityContent = EntityContentBlueprint.make({
  name: 'cost-analysis',
  params: {
    path: '/cost-analysis',
    title: 'Cost Analysis',
    filter: 'kind:system',
    loader: () =>
      import('./components/CostAnalysis').then(m => (
        <FeatureGatedContent feature="observability">
          <m.CostAnalysisPage />
        </FeatureGatedContent>
      )),
  },
});

/**
 * NFS entry point for the OpenChoreo Observability plugin.
 *
 * Registers the three observability backend clients, the log-row-action
 * registry API, the component-page entity tabs (Logs, Events, Metrics,
 * Alerts, Wirelogs) and the system-page entity tabs (Logs, Traces,
 * Incidents, RCA Reports, Cost Analysis).
 */
export default createFrontendPlugin({
  pluginId: 'openchoreo-observability',
  routes: { root: rootRouteRef },
  extensions: [
    observabilityApi,
    queryProvider,
    rcaAgentApi,
    finopsAgentApi,
    logRowActionRendererApi,
    runtimeLogsEntityContent,
    runtimeEventsEntityContent,
    metricsEntityContent,
    alertsEntityContent,
    wirelogsEntityContent,
    projectRuntimeLogsEntityContent,
    tracesEntityContent,
    projectIncidentsEntityContent,
    rcaReportsEntityContent,
    costAnalysisEntityContent,
  ],
});
