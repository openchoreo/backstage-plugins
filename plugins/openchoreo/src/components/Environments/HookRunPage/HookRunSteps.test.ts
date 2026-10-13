import { orderStepsByStart } from './HookRunSteps';

// A hook run must read in the order it executed. Argo reports the onExit
// handler (which runs last, e.g. the Slack notification) before the main
// step, so the page would otherwise show the notification above the scan.
describe('orderStepsByStart', () => {
  it('puts the step that started first on top', () => {
    const steps = orderStepsByStart([
      {
        name: 'run.onExit',
        phase: 'Succeeded',
        startedAt: '2026-09-24T17:02:10Z',
      },
      { name: 'run', phase: 'Succeeded', startedAt: '2026-09-24T17:00:50Z' },
    ]);
    expect(steps.map(s => s.name)).toEqual(['run', 'run.onExit']);
  });

  it('keeps steps that have not started after the started ones, in their original order', () => {
    const steps = orderStepsByStart([
      { name: 'pending-a', phase: 'Pending' },
      { name: 'late', phase: 'Running', startedAt: '2026-09-24T17:05:00Z' },
      { name: 'pending-b', phase: 'Pending', startedAt: null },
      { name: 'early', phase: 'Succeeded', startedAt: '2026-09-24T17:00:00Z' },
    ]);
    expect(steps.map(s => s.name)).toEqual([
      'early',
      'late',
      'pending-a',
      'pending-b',
    ]);
  });
});
