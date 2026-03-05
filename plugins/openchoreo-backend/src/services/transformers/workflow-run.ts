import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { ComponentWorkflowRunResponse } from '@openchoreo/backstage-plugin-common';
import { CHOREO_LABELS } from '@openchoreo/backstage-plugin-common';

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

  // Derive overall status.
  // completedAt is the strongest signal — if set, the run is definitively done
  // and we never return an in-progress status even if K8s conditions are stale.
  const readyCondition = run.status?.conditions?.find(c => c.type === 'Ready');
  const tasks = (run.status?.tasks ?? []) as Array<{
    phase?: string;
    completedAt?: string;
  }>;

  let status: string;
  if (run.status?.completedAt) {
    if (tasks.some(t => t.phase === 'Failed' || t.phase === 'Error')) {
      status = 'Failed';
    } else {
      const reason = readyCondition?.reason;
      status =
        reason && reason !== 'Running' && reason !== 'Pending'
          ? reason
          : 'Succeeded';
    }
  } else if (readyCondition) {
    status =
      readyCondition.reason ||
      (readyCondition.status === 'True' ? 'Succeeded' : 'Running');
  } else if (tasks.some(t => t.phase === 'Failed' || t.phase === 'Error')) {
    status = 'Failed';
  } else if (tasks.length > 0 && tasks.every(t => t.phase === 'Succeeded')) {
    status = 'Succeeded';
  } else if (tasks.some(t => t.phase === 'Running')) {
    status = 'Running';
  } else if (run.status?.startedAt) {
    status = 'Running';
  } else {
    status = 'Pending';
  }

  return {
    name: run.metadata?.name ?? '',
    uuid: run.metadata?.uid ?? '',
    componentName: labels[CHOREO_LABELS.WORKFLOW_COMPONENT] ?? '',
    projectName: labels[CHOREO_LABELS.WORKFLOW_PROJECT] ?? '',
    namespaceName: run.metadata?.namespace ?? '',
    status,
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
