import { isStepLive, isTerminalStatus } from './workflowStatus';

describe('isTerminalStatus', () => {
  it.each(['completed', 'failed', 'succeeded', 'error'])(
    'returns true for terminal status %s',
    status => {
      expect(isTerminalStatus(status)).toBe(true);
    },
  );

  it('is case-insensitive', () => {
    expect(isTerminalStatus('Completed')).toBe(true);
    expect(isTerminalStatus('SUCCEEDED')).toBe(true);
    expect(isTerminalStatus('Failed')).toBe(true);
  });

  it.each(['running', 'pending', 'queued', 'unknown', ''])(
    'returns false for non-terminal status %s',
    status => {
      expect(isTerminalStatus(status)).toBe(false);
    },
  );

  it('returns false for undefined', () => {
    expect(isTerminalStatus(undefined)).toBe(false);
  });
});

describe('isStepLive', () => {
  it('returns true when the step is running and the parent is not terminal', () => {
    expect(isStepLive({ phase: 'Running' }, 'running')).toBe(true);
  });

  it('returns false when the step is not running', () => {
    expect(isStepLive({ phase: 'Pending' }, 'running')).toBe(false);
    expect(isStepLive({ phase: 'Succeeded' }, 'running')).toBe(false);
  });

  it('returns false when the parent has reached a terminal phase', () => {
    // Even if a step still reports "running", a terminal parent means the
    // step won't actually produce more output.
    expect(isStepLive({ phase: 'running' }, 'succeeded')).toBe(false);
    expect(isStepLive({ phase: 'running' }, 'Failed')).toBe(false);
  });

  it('returns false when the step is undefined', () => {
    expect(isStepLive(undefined, 'running')).toBe(false);
  });

  it('returns false when the step has no phase', () => {
    expect(isStepLive({}, 'running')).toBe(false);
  });
});
