import { deriveWorkflowRunStatus } from './GenericWorkflowService';

describe('deriveWorkflowRunStatus', () => {
  it('returns Pending for empty conditions', () => {
    expect(deriveWorkflowRunStatus({})).toBe('Pending');
    expect(deriveWorkflowRunStatus({ status: { conditions: [] } })).toBe('Pending');
  });

  it('returns Failed for pre-Argo failure conditions (catch-all)', () => {
    const failureReasons = [
      'WorkflowRenderingFailed',
      'WorkflowPlaneNotFound',
      'WorkflowPlaneResolutionFailed',
      'WorkflowResolutionFailed',
      'ComponentValidationFailed',
      'AnyFuturePreExecutionError',
    ];

    for (const reason of failureReasons) {
      const run = {
        status: {
          conditions: [
            {
              type: 'WorkflowCompleted',
              status: 'False',
              reason,
              message: 'Failed to render workflow',
            },
          ],
        },
      };
      expect(deriveWorkflowRunStatus(run)).toBe('Failed');
    }
  });

  it('does not return Failed for pre-Argo WorkflowPending or WorkflowRunning reasons', () => {
    const pendingRun = {
      status: {
        conditions: [
          {
            type: 'WorkflowCompleted',
            status: 'False',
            reason: 'WorkflowPending',
          },
        ],
      },
    };
    expect(deriveWorkflowRunStatus(pendingRun)).toBe('Pending');

    const runningRun = {
      status: {
        conditions: [
          {
            type: 'WorkflowCompleted',
            status: 'False',
            reason: 'WorkflowRunning',
          },
          {
            type: 'WorkflowRunning',
            status: 'True',
          },
        ],
      },
    };
    expect(deriveWorkflowRunStatus(runningRun)).toBe('Running');
  });

  it('returns Succeeded when WorkflowSucceeded condition is True', () => {
    const run = {
      status: {
        conditions: [
          {
            type: 'WorkflowCompleted',
            status: 'True',
            reason: 'WorkflowSucceeded',
          },
          {
            type: 'WorkflowSucceeded',
            status: 'True',
          },
        ],
      },
    };
    expect(deriveWorkflowRunStatus(run)).toBe('Succeeded');
  });

  it('returns Failed when WorkflowFailed condition is True', () => {
    const run = {
      status: {
        conditions: [
          {
            type: 'WorkflowFailed',
            status: 'True',
            reason: 'WorkflowFailed',
            message: 'Step container error',
          },
        ],
      },
    };
    expect(deriveWorkflowRunStatus(run)).toBe('Failed');
  });
});
