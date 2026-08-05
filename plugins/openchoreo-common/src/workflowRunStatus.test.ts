import { deriveWorkflowRunDisplayStatus } from './workflowRunStatus';

describe('deriveWorkflowRunDisplayStatus', () => {
  it('returns Pending when status is absent', () => {
    expect(deriveWorkflowRunDisplayStatus({})).toBe('Pending');
  });

  it('returns Failed for typed WorkflowFailed condition', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          conditions: [
            { type: 'WorkflowFailed', status: 'True', reason: 'Failed' },
          ],
        },
      }),
    ).toBe('Failed');
  });

  it('returns Succeeded for typed WorkflowSucceeded condition', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          conditions: [
            { type: 'WorkflowSucceeded', status: 'True', reason: 'Succeeded' },
          ],
        },
      }),
    ).toBe('Succeeded');
  });

  it('returns Failed for WorkflowCompleted=True reason WorkflowFailed', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          completedAt: '2026-08-04T10:26:02Z',
          conditions: [
            {
              type: 'WorkflowCompleted',
              status: 'True',
              reason: 'WorkflowFailed',
              message: 'Workflow has been deleted from the cluster',
            },
            {
              type: 'WorkflowRunning',
              status: 'False',
              reason: 'WorkflowRunning',
            },
          ],
          tasks: [{ phase: 'Pending' }],
        },
      }),
    ).toBe('Failed');
  });

  it('returns Failed for WorkflowCompleted ComponentValidationFailed', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          completedAt: '2026-08-04T10:00:00Z',
          conditions: [
            {
              type: 'WorkflowCompleted',
              status: 'True',
              reason: 'ComponentValidationFailed',
            },
          ],
        },
      }),
    ).toBe('Failed');
  });

  it('returns Succeeded for WorkflowCompleted=True reason WorkflowSucceeded', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          completedAt: '2026-08-04T10:00:00Z',
          conditions: [
            {
              type: 'WorkflowCompleted',
              status: 'True',
              reason: 'WorkflowSucceeded',
            },
          ],
        },
      }),
    ).toBe('Succeeded');
  });

  it('prefers WorkflowCompleted failure over typed WorkflowSucceeded', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          completedAt: '2026-08-04T10:00:00Z',
          conditions: [
            {
              type: 'WorkflowSucceeded',
              status: 'True',
              reason: 'WorkflowSucceeded',
            },
            {
              type: 'WorkflowCompleted',
              status: 'True',
              reason: 'WorkflowFailed',
            },
          ],
        },
      }),
    ).toBe('Failed');
  });

  it('normalizes unrecognized terminal WorkflowCompleted reason to Completed', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          completedAt: '2026-08-04T10:00:00Z',
          conditions: [
            {
              type: 'WorkflowCompleted',
              status: 'True',
              reason: 'Cancelled',
            },
          ],
        },
      }),
    ).toBe('Completed');
  });

  it('does not treat WorkflowCompleted=False WorkflowPending as terminal Failed', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          startedAt: '2026-08-04T10:00:00Z',
          conditions: [
            {
              type: 'WorkflowCompleted',
              status: 'False',
              reason: 'WorkflowPending',
            },
            {
              type: 'WorkflowRunning',
              status: 'True',
              reason: 'WorkflowRunning',
            },
          ],
        },
      }),
    ).toBe('Running');
  });

  it('returns Completed for WorkloadUpdated', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          conditions: [
            { type: 'WorkloadUpdated', status: 'True', reason: '' },
          ],
        },
      }),
    ).toBe('Completed');
  });

  it('returns Failed from completedAt when a task phase is Failed', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          completedAt: '2026-08-04T10:00:00Z',
          conditions: [],
          tasks: [{ phase: 'Failed' }],
        },
      }),
    ).toBe('Failed');
  });

  it('returns Succeeded from completedAt when no failure signal', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: {
          completedAt: '2026-08-04T10:00:00Z',
          conditions: [
            {
              type: 'Ready',
              status: 'False',
              reason: 'Running',
            },
          ],
        },
      }),
    ).toBe('Succeeded');
  });

  it('returns Running from startedAt when no conditions', () => {
    expect(
      deriveWorkflowRunDisplayStatus({
        status: { startedAt: '2026-08-04T10:00:00Z', conditions: [] },
      }),
    ).toBe('Running');
  });
});
