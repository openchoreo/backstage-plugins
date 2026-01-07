import {
  createPlugin,
  createRoutableExtension,
  createComponentExtension,
  createApiFactory,
  discoveryApiRef,
  fetchApiRef,
} from '@backstage/core-plugin-api';
import { openChoreoClientApiRef } from './api/OpenChoreoClientApi';
import { OpenChoreoClient } from './api/OpenChoreoClient';
import {
  rootCatalogEnvironmentRouteRef,
  rootCatalogTraitsRouteRef,
  accessControlRouteRef,
} from './routes';

export const choreoPlugin = createPlugin({
  id: 'openchoreo',
  apis: [
    createApiFactory({
      api: openChoreoClientApiRef,
      deps: {
        discoveryApi: discoveryApiRef,
        fetchApi: fetchApiRef,
      },
      factory: ({ discoveryApi, fetchApi }) =>
        new OpenChoreoClient(discoveryApi, fetchApi),
    }),
  ],
});

// Component page tab
export const Environments = choreoPlugin.provide(
  createRoutableExtension({
    name: 'ChoreoEnvironments',
    component: () =>
      import('./components/Environments').then(m => m.Environments),
    mountPoint: rootCatalogEnvironmentRouteRef,
  }),
);

// System entity page tab
export const CellDiagram = choreoPlugin.provide(
  createRoutableExtension({
    name: 'ChoreoSystemTab',
    component: () =>
      import('./components/CellDiagram/CellDiagram').then(m => m.CellDiagram),
    mountPoint: rootCatalogEnvironmentRouteRef,
  }),
);

// Traits page tab
export const Traits = choreoPlugin.provide(
  createRoutableExtension({
    name: 'ChoreoTraits',
    component: () => import('./components/Traits').then(m => m.Traits),
    mountPoint: rootCatalogTraitsRouteRef,
  }),
);

// Overview cards (non-routable components for entity overview page)
export const WorkflowsOverviewCard = choreoPlugin.provide(
  createComponentExtension({
    name: 'WorkflowsOverviewCard',
    component: {
      lazy: () =>
        import('./components/Workflows').then(m => m.WorkflowsOverviewCard),
    },
  }),
);

export const ProductionOverviewCard = choreoPlugin.provide(
  createComponentExtension({
    name: 'ProductionOverviewCard',
    component: {
      lazy: () =>
        import('./components/Environments').then(m => m.ProductionOverviewCard),
    },
  }),
);

export const RuntimeHealthCard = choreoPlugin.provide(
  createComponentExtension({
    name: 'RuntimeHealthCard',
    component: {
      lazy: () =>
        import('./components/RuntimeLogs').then(m => m.RuntimeHealthCard),
    },
  }),
);

export const DeploymentPipelineCard = choreoPlugin.provide(
  createComponentExtension({
    name: 'DeploymentPipelineCard',
    component: {
      lazy: () =>
        import('./components/Projects/OverviewCards').then(
          m => m.DeploymentPipelineCard,
        ),
    },
  }),
);

// Access Control page
export const AccessControlPage = choreoPlugin.provide(
  createRoutableExtension({
    name: 'AccessControlPage',
    component: () =>
      import('./components/AccessControl').then(m => m.AccessControlPage),
    mountPoint: accessControlRouteRef,
  }),
);
