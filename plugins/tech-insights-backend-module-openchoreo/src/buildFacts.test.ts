import { buildFacts, type WorkflowRun } from './buildFacts';

const condition = (type: string, value = 'True') => ({ type, status: value });

function run(
  createdAt: string,
  ...conditions: { type: string; status: string }[]
): WorkflowRun {
  return {
    metadata: { creationTimestamp: createdAt },
    status: { conditions },
  };
}

const succeededRun = (createdAt: string) =>
  run(
    createdAt,
    condition('WorkflowCompleted'),
    condition('WorkflowSucceeded'),
  );
const failedRun = (createdAt: string) =>
  run(createdAt, condition('WorkflowCompleted'), condition('WorkflowFailed'));
const runningRun = (createdAt: string) =>
  run(createdAt, condition('WorkflowRunning'));

describe('buildFacts', () => {
  it('reports the newest finished build and the share that succeeded', () => {
    expect(
      buildFacts([
        succeededRun('2026-11-01T10:00:00Z'),
        failedRun('2026-11-03T10:00:00Z'),
        succeededRun('2026-11-02T10:00:00Z'),
        succeededRun('2026-11-04T10:00:00Z'),
      ]),
    ).toEqual({
      openchoreoBuildLastSucceeded: true,
      openchoreoBuildSuccessRate: 0.75,
    });
  });

  it('orders runs by creation time, not by the order they are listed in', () => {
    expect(
      buildFacts([
        succeededRun('2026-11-01T10:00:00Z'),
        failedRun('2026-11-05T10:00:00Z'),
        succeededRun('2026-11-03T10:00:00Z'),
      ]).openchoreoBuildLastSucceeded,
    ).toBe(false);
  });

  it('skips runs that have not finished', () => {
    expect(
      buildFacts([
        succeededRun('2026-11-01T10:00:00Z'),
        runningRun('2026-11-05T10:00:00Z'),
        run('2026-11-06T10:00:00Z', condition('WorkflowCompleted', 'False')),
      ]),
    ).toEqual({
      openchoreoBuildLastSucceeded: true,
      openchoreoBuildSuccessRate: 1,
    });
  });

  it('counts a failed condition over a succeeded one', () => {
    expect(
      buildFacts([
        run(
          '2026-11-01T10:00:00Z',
          condition('WorkflowCompleted'),
          condition('WorkflowSucceeded'),
          condition('WorkflowFailed'),
        ),
      ]),
    ).toEqual({
      openchoreoBuildLastSucceeded: false,
      openchoreoBuildSuccessRate: 0,
    });
  });

  it('counts a run that failed validation as a failed build', () => {
    expect(
      buildFacts([
        succeededRun('2026-11-01T10:00:00Z'),
        run(
          '2026-11-02T10:00:00Z',
          condition('WorkflowCompleted'),
          condition('WorkflowFailed'),
          condition('ComponentValidationFailed'),
        ),
      ]),
    ).toEqual({
      openchoreoBuildLastSucceeded: false,
      openchoreoBuildSuccessRate: 0.5,
    });
  });

  it('rates only the newest 20 finished builds', () => {
    const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n)).toISOString();
    const runs = [
      ...Array.from({ length: 5 }, (_, i) => failedRun(day(i))),
      ...Array.from({ length: 20 }, (_, i) => succeededRun(day(10 + i))),
    ];
    expect(buildFacts(runs).openchoreoBuildSuccessRate).toBe(1);
  });

  it('reports nothing when no finished build is retained', () => {
    expect(buildFacts([])).toEqual({});
    expect(buildFacts([runningRun('2026-11-05T10:00:00Z')])).toEqual({});
  });
});
