import type { ModelsBuild } from '@openchoreo/backstage-plugin-common';

/**
 * View mode for the Workflows component
 * Controls which view is displayed (list, config page, or run details page)
 */
export type WorkflowViewMode =
  | { type: 'list' }
  | { type: 'config' }
  | { type: 'run-details'; run: ModelsBuild };
