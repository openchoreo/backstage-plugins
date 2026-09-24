import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { ComponentWorkflowRunResponse } from '@openchoreo/backstage-plugin-common';
import {
  CHOREO_LABELS,
  deriveWorkflowRunDisplayStatus,
} from '@openchoreo/backstage-plugin-common';

// New K8s-style WorkflowRun (metadata + spec + status)
type WorkflowRun = OpenChoreoComponents['schemas']['WorkflowRun'];

/**
 * Transforms a new-API WorkflowRun (K8s-style) into the legacy
 * ComponentWorkflowRunResponse shape used by the frontend.
 * Component/project context is extracted from metadata labels.
 */
export function transformComponentWorkflowRun(
  run: WorkflowRun,
): ComponentWorkflowRunResponse {
  const labels = run.metadata?.labels ?? {};
  const annotations = run.metadata?.annotations ?? {};

  return {
    name: run.metadata?.name ?? '',
    uuid: run.metadata?.uid ?? '',
    componentName: labels[CHOREO_LABELS.WORKFLOW_COMPONENT] ?? '',
    projectName: labels[CHOREO_LABELS.WORKFLOW_PROJECT] ?? '',
    namespaceName: run.metadata?.namespace ?? '',
    status: deriveWorkflowRunDisplayStatus(run),
    commit: annotations['openchoreo.dev/commit'],
    image: annotations['openchoreo.dev/image'],
    createdAt: run.metadata?.creationTimestamp,
    workflow: run.spec?.workflow
      ? {
          name: run.spec.workflow.name,
          parameters: run.spec.workflow.parameters as Record<string, unknown>,
        }
      : undefined,
  };
}
