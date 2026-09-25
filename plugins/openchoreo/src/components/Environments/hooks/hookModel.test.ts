import {
  blockingFailure,
  deriveEnvironmentHooks,
  hookSectionsHeight,
  hookSummary,
} from './hookModel';

const scan = {
  name: 'image-scan',
  hookRef: { kind: 'ClusterHook' as const, name: 'trivy-image-scan' },
};

describe('deriveEnvironmentHooks', () => {
  // A bound hook must show on the card before its first run, so users see
  // what will gate the next release — not only what already ran.
  it('lists bound hooks that have not run yet as pending', () => {
    const hooks = deriveEnvironmentHooks(
      {
        preDeploy: [scan],
        postDeploy: [{ name: 'notify', hookRef: { name: 'n' }, mode: 'Async' }],
      },
      undefined,
    );
    expect(hooks.pre.map(r => [r.name, r.state, r.stateText])).toEqual([
      ['image-scan', 'pending', 'Not started'],
    ]);
    expect(hooks.post.map(r => [r.name, r.state, r.stateText])).toEqual([
      ['notify', 'pending', 'Waiting for deploy'],
    ]);
  });

  // A failure only blocks when the policy says so; an ignored failure let the
  // release through and must not read as "blocked".
  it('marks a failure as blocking or ignored according to the effective policy', () => {
    const failed = { phase: 'Failed' as const, workflowRunRef: 'run-1' };
    const blocked = deriveEnvironmentHooks(
      { preDeploy: [scan] },
      { preDeploy: [{ name: 'image-scan', ...failed }] },
    );
    expect(blocked.pre[0]).toMatchObject({
      state: 'fail',
      stateText: 'Failed',
      onFailure: 'Block',
    });
    expect(blockingFailure(blocked)?.name).toBe('image-scan');

    const ignored = deriveEnvironmentHooks(
      { preDeploy: [{ ...scan, onFailure: 'Ignore' }] },
      { preDeploy: [{ name: 'image-scan', ...failed }] },
    );
    expect(ignored.pre[0]).toMatchObject({
      state: 'ignored',
      stateText: 'Failed, ignored',
    });
    expect(blockingFailure(ignored)).toBeUndefined();

    // Post-deploy defaults to Ignore.
    const post = deriveEnvironmentHooks(
      { postDeploy: [{ name: 'smoke', hookRef: { name: 's' } }] },
      {
        postDeploy: [{ name: 'smoke', phase: 'TimedOut', workflowRunRef: 'r' }],
      },
    );
    expect(post.post[0].stateText).toBe('Timed out, ignored');
  });

  it('maps running, succeeded, dispatched and skipped phases', () => {
    const hooks = deriveEnvironmentHooks(
      {
        preDeploy: [scan, { name: 'e2e', hookRef: { name: 'e' } }],
        postDeploy: [
          { name: 'notify', hookRef: { name: 'n' }, mode: 'Async' },
          { name: 'other', hookRef: { name: 'o' } },
        ],
      },
      {
        preDeploy: [
          { name: 'image-scan', phase: 'Running', workflowRunRef: 'r1' },
          { name: 'e2e', phase: 'Succeeded', workflowRunRef: 'r2' },
        ],
        postDeploy: [
          { name: 'notify', phase: 'Dispatched', workflowRunRef: 'r3' },
          { name: 'other', phase: 'Skipped' },
        ],
      },
    );
    expect(hooks.pre.map(r => r.state)).toEqual(['running', 'ok']);
    expect(hooks.post.map(r => r.state)).toEqual(['ok', 'skipped']);
    expect(hookSummary(hooks.pre)).toBe('1/2');
  });

  it('keeps a gate entry whose binding was removed since it ran', () => {
    const hooks = deriveEnvironmentHooks(
      { preDeploy: [] },
      {
        preDeploy: [
          { name: 'old-scan', phase: 'Succeeded', workflowRunRef: 'r' },
        ],
      },
    );
    expect(hooks.pre.map(r => r.name)).toEqual(['old-scan']);
  });
});

describe('hookSectionsHeight', () => {
  it('is zero without hooks and grows with each phase and row', () => {
    expect(hookSectionsHeight(undefined)).toBe(0);
    expect(hookSectionsHeight({ pre: [], post: [] })).toBe(0);
    const one = hookSectionsHeight(
      deriveEnvironmentHooks({ preDeploy: [scan] }, undefined),
    );
    const two = hookSectionsHeight(
      deriveEnvironmentHooks(
        { preDeploy: [scan, { name: 'b', hookRef: { name: 'b' } }] },
        undefined,
      ),
    );
    expect(one).toBeGreaterThan(0);
    expect(two).toBeGreaterThan(one);
  });
});
