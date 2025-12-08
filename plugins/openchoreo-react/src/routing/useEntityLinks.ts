import { useMemo } from 'react';
import { Entity } from '@backstage/catalog-model';
import type { PendingAction, RunDetailsTab, WorkflowTab } from './types';
import {
  buildEnvironmentsBasePath,
  buildWorkflowsBasePath,
  buildRuntimeLogsBasePath,
  buildOverridesPath,
  buildReleaseDetailsPath,
  buildWorkloadConfigPath,
  buildOverridesPathWithTab,
  buildWorkflowRunPath,
  buildWorkflowConfigPath,
  buildWorkflowListPath,
} from './pathBuilders';

export interface EntityLinks {
  // Environment links
  environmentsBase: string;
  overrides: (envName: string, pendingAction?: PendingAction) => string;
  overridesWithTab: (envName: string, tabId: string) => string;
  releaseDetails: (envName: string) => string;
  workloadConfig: () => string;

  // Workflow links
  workflowsBase: string;
  workflowRun: (runId: string, tab?: RunDetailsTab) => string;
  workflowConfig: () => string;
  workflowList: (tab?: WorkflowTab) => string;

  // Other links
  runtimeLogsBase: string;
}

/**
 * Hook that provides link builders for an entity.
 * Use this when you need to create links to environment/workflow pages.
 *
 * @example
 * ```tsx
 * const { entity } = useEntity();
 * const links = useEntityLinks(entity);
 *
 * // Create a link to production overrides
 * <Link to={links.overrides('production')}>View Overrides</Link>
 *
 * // Create a promote link
 * <Link to={links.overrides('staging', { type: 'promote', ... })}>Promote</Link>
 *
 * // Create a link to workflow run
 * <Link to={links.workflowRun('build-123')}>View Build</Link>
 * ```
 */
export function useEntityLinks(entity: Entity): EntityLinks {
  return useMemo(() => {
    const envBase = buildEnvironmentsBasePath(entity);
    const wfBase = buildWorkflowsBasePath(entity);
    const logsBase = buildRuntimeLogsBasePath(entity);

    return {
      environmentsBase: envBase,
      overrides: (envName, pendingAction) =>
        buildOverridesPath(envBase, envName, pendingAction),
      overridesWithTab: (envName, tabId) =>
        buildOverridesPathWithTab(envBase, envName, tabId),
      releaseDetails: envName => buildReleaseDetailsPath(envBase, envName),
      workloadConfig: () => buildWorkloadConfigPath(envBase),

      workflowsBase: wfBase,
      workflowRun: (runId, tab) => buildWorkflowRunPath(wfBase, runId, tab),
      workflowConfig: () => buildWorkflowConfigPath(wfBase),
      workflowList: tab => buildWorkflowListPath(wfBase, tab),

      runtimeLogsBase: logsBase,
    };
  }, [entity]);
}
