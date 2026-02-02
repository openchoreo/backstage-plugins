import { createRouteRef, createSubRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'openchoreo-workflows',
});

export const workflowDetailsRouteRef = createSubRouteRef({
  id: 'openchoreo-workflows-details',
  parent: rootRouteRef,
  path: '/:workflowName',
});

export const triggerWorkflowRouteRef = createSubRouteRef({
  id: 'openchoreo-workflows-trigger',
  parent: rootRouteRef,
  path: '/:workflowName/trigger',
});

export const workflowRunDetailsRouteRef = createSubRouteRef({
  id: 'openchoreo-workflows-run-details',
  parent: rootRouteRef,
  path: '/runs/:runName',
});
