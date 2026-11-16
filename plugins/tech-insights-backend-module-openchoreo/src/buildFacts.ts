/** The subset of a WorkflowRun read here. */
export interface WorkflowRun {
  metadata?: { creationTimestamp?: string };
  status?: {
    conditions?: { type: string; status: string }[];
  };
}

/** How many of the newest finished builds the success rate covers. */
export const SUCCESS_RATE_WINDOW = 20;

function hasCondition(run: WorkflowRun, type: string): boolean {
  return (
    run.status?.conditions?.some(
      condition => condition.type === type && condition.status === 'True',
    ) ?? false
  );
}

/**
 * Whether a run has finished, the way the OpenChoreo API decides it. A run
 * that never reached its workflow plane or never rendered stays unfinished.
 */
function isFinished(run: WorkflowRun): boolean {
  return hasCondition(run, 'WorkflowCompleted');
}

/** A failed condition wins over a succeeded one, as in the OpenChoreo API. */
function succeeded(run: WorkflowRun): boolean {
  return (
    hasCondition(run, 'WorkflowSucceeded') &&
    !hasCondition(run, 'WorkflowFailed')
  );
}

function createdAt(run: WorkflowRun): number {
  const time = Date.parse(run.metadata?.creationTimestamp ?? '');
  return Number.isNaN(time) ? 0 : time;
}

/**
 * Facts read from a component's builds. Runs come back in name order, so
 * they are sorted by creation time first. A run that failed before its
 * workflow ran, for example on validation, counts as a failed build. Both
 * facts are left out when no finished run is retained, since runs are
 * deleted a while after they finish and none retained doesn't mean none
 * succeeded.
 */
export function buildFacts(
  runs: WorkflowRun[],
): Record<string, boolean | number> {
  const finished = runs
    .filter(isFinished)
    .sort((a, b) => createdAt(b) - createdAt(a))
    .slice(0, SUCCESS_RATE_WINDOW);
  if (finished.length === 0) {
    return {};
  }
  return {
    openchoreoBuildLastSucceeded: succeeded(finished[0]),
    openchoreoBuildSuccessRate:
      finished.filter(succeeded).length / finished.length,
  };
}
