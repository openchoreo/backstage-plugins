/**
 * Derive a UI-facing WorkflowRun status from the raw K8s-style CR.
 *
 * OpenChoreo controllers expose two overlapping condition vocabularies:
 *   - typed: WorkflowFailed / WorkflowSucceeded / WorkflowRunning
 *   - completed: WorkflowCompleted=True with reason WorkflowFailed|WorkflowSucceeded|…
 *
 * UI that only checks typed conditions mis-labels completed failures as Pending.
 * completedAt is a terminal signal, but must not map to Succeeded when
 * WorkflowCompleted reason indicates failure — status.tasks can lag
 * (e.g. stuck Pending while Argo already Failed).
 *
 * Failure from `WorkflowCompleted` takes precedence over typed
 * `WorkflowSucceeded` when both are present.
 *
 * See also openchoreo/openchoreo#3877 (controller sets typed WorkflowFailed on
 * some validation paths) and the WorkflowRun API condition docs.
 */

export type WorkflowRunStatusCondition = {
  type?: string;
  status?: string;
  reason?: string;
  message?: string;
};

export type WorkflowRunStatusTask = {
  phase?: string;
  completedAt?: string;
};

export type WorkflowRunStatusSource = {
  status?: {
    conditions?: WorkflowRunStatusCondition[];
    tasks?: WorkflowRunStatusTask[];
    startedAt?: string;
    completedAt?: string;
  };
};

const FAILURE_REASON_RE = /Fail|Error|Invalid|Denied|Timeout/i;

/** True when a condition reason indicates terminal or in-progress failure. */
function isFailureReason(reason?: string): boolean {
  if (!reason) return false;
  if (
    reason === 'Running' ||
    reason === 'Pending' ||
    reason === 'WorkflowPending'
  ) {
    return false;
  }
  return FAILURE_REASON_RE.test(reason);
}

/** True when a WorkflowCompleted (or similar) reason denotes success. */
function isSuccessReason(reason?: string): boolean {
  return (
    reason === 'WorkflowSucceeded' ||
    reason === 'Succeeded' ||
    reason === 'Completed'
  );
}

/**
 * Returns a display status string used by portal CI/Workflows UIs:
 * Pending | Running | Succeeded | Failed | Completed.
 */
export function deriveWorkflowRunDisplayStatus(
  run: WorkflowRunStatusSource,
): string {
  const conditions = run.status?.conditions ?? [];
  const tasks = (run.status?.tasks ?? []) as WorkflowRunStatusTask[];

  if (
    conditions.some(c => c.type === 'WorkflowFailed' && c.status === 'True')
  ) {
    return 'Failed';
  }

  const workflowCompleted = conditions.find(
    c => c.type === 'WorkflowCompleted',
  );
  // Prefer aggregate completion failure over typed success when both exist.
  if (
    workflowCompleted?.status === 'True' &&
    isFailureReason(workflowCompleted.reason)
  ) {
    return 'Failed';
  }

  if (
    conditions.some(c => c.type === 'WorkflowSucceeded' && c.status === 'True')
  ) {
    return 'Succeeded';
  }

  if (workflowCompleted?.status === 'True') {
    const reason = workflowCompleted.reason;
    if (isSuccessReason(reason) || !reason) {
      return 'Succeeded';
    }
    // Unrecognized terminal reasons stay within the documented status set.
    if (
      reason !== 'Running' &&
      reason !== 'Pending' &&
      reason !== 'WorkflowPending'
    ) {
      return 'Completed';
    }
  }

  if (
    conditions.some(c => c.type === 'WorkloadUpdated' && c.status === 'True')
  ) {
    return 'Completed';
  }

  const readyCondition = conditions.find(c => c.type === 'Ready');

  if (run.status?.completedAt) {
    if (tasks.some(t => t.phase === 'Failed' || t.phase === 'Error')) {
      return 'Failed';
    }
    // Stale tasks may still say Pending while the run is done — prefer
    // WorkflowCompleted reason over inventing Succeeded.
    if (workflowCompleted && isFailureReason(workflowCompleted.reason)) {
      return 'Failed';
    }
    const reason = readyCondition?.reason;
    if (reason && reason !== 'Running' && reason !== 'Pending') {
      return isFailureReason(reason) ? 'Failed' : reason;
    }
    return 'Succeeded';
  }

  if (readyCondition) {
    const reason = readyCondition.reason;
    if (reason) {
      if (isFailureReason(reason)) return 'Failed';
      return reason;
    }
    return readyCondition.status === 'True' ? 'Succeeded' : 'Running';
  }

  if (
    conditions.some(c => c.type === 'WorkflowRunning' && c.status === 'True')
  ) {
    return 'Running';
  }

  if (tasks.some(t => t.phase === 'Failed' || t.phase === 'Error')) {
    return 'Failed';
  }
  if (tasks.length > 0 && tasks.every(t => t.phase === 'Succeeded')) {
    return 'Succeeded';
  }
  if (tasks.some(t => t.phase === 'Running')) {
    return 'Running';
  }
  if (run.status?.startedAt) {
    return 'Running';
  }
  return 'Pending';
}
