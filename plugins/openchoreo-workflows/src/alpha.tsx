import {
  ApiBlueprint,
  createFrontendPlugin,
  discoveryApiRef,
  fetchApiRef,
  PageBlueprint,
  PluginWrapperBlueprint,
} from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';

import { rootRouteRef } from './routes';
import { genericWorkflowsClientApiRef } from './api/GenericWorkflowsClientApi';
import { GenericWorkflowsClient } from './api/GenericWorkflowsClient';

const genericWorkflowsClientApi = ApiBlueprint.make({
  name: 'generic-workflows-client',
  params: defineParams =>
    defineParams({
      api: genericWorkflowsClientApiRef,
      deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
      factory: ({ discoveryApi, fetchApi }) =>
        new GenericWorkflowsClient(discoveryApi, fetchApi),
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

const genericWorkflowsPage = PageBlueprint.make({
  name: 'generic-workflows',
  params: {
    path: '/workflows',
    routeRef: rootRouteRef,
    loader: () =>
      import('./components/GenericWorkflowsPage').then(m => (
        <m.GenericWorkflowsPage />
      )),
  },
});

/**
 * Workflow Runs entity tab — mounts under workflow and clusterworkflow
 * kinds, but only for entries with `spec.type === 'Generic'`. The
 * EntityNamespaceProvider supplies the entity's namespace to the runs
 * table via React context, matching the legacy `EntityPage.tsx` mount.
 */
const workflowRunsEntityContent = EntityContentBlueprint.make({
  name: 'workflow-runs',
  params: {
    path: '/runs',
    title: 'Runs',
    filter: entity =>
      ['workflow', 'clusterworkflow'].includes(entity.kind.toLowerCase()) &&
      (entity.spec as { type?: string } | undefined)?.type === 'Generic',
    loader: () =>
      Promise.all([
        import('./components/WorkflowRunsContent'),
        import('./components/EntityNamespaceProvider'),
      ]).then(([runs, provider]) => (
        <provider.EntityNamespaceProvider>
          <runs.WorkflowRunsContent />
        </provider.EntityNamespaceProvider>
      )),
  },
});

/**
 * NFS entry point for the OpenChoreo generic-workflows plugin.
 */
export default createFrontendPlugin({
  pluginId: 'openchoreo-workflows',
  routes: { root: rootRouteRef },
  extensions: [
    genericWorkflowsClientApi,
    queryProvider,
    genericWorkflowsPage,
    workflowRunsEntityContent,
  ],
});
