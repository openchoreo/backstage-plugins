import {
  createPlugin,
  createRoutableExtension,
  createComponentExtension,
} from '@backstage/core-plugin-api';
import {
  rootCatalogEnvironmentRouteRef,
  rootCatalogRuntimeLogsRouteRef,
  rootCatalogWorkflowsRouteRef,
} from './routes';

export const choreoPlugin = createPlugin({
  id: 'openchoreo',
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

// Runtime logs page tab
export const RuntimeLogs = choreoPlugin.provide(
  createRoutableExtension({
    name: 'ChoreoRuntimeLogs',
    component: () =>
      import('./components/RuntimeLogs/RuntimeLogs').then(m => m.RuntimeLogs),
    mountPoint: rootCatalogRuntimeLogsRouteRef,
  }),
);

// Workflows page tab
export const Workflows = choreoPlugin.provide(
  createRoutableExtension({
    name: 'ChoreoWorkflows',
    component: () => import('./components/Workflows').then(m => m.Workflows),
    mountPoint: rootCatalogWorkflowsRouteRef,
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
