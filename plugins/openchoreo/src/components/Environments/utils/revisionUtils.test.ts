import { ResponseError } from '@backstage/errors';
import type { ReleaseBindingRevision } from '@openchoreo/backstage-plugin-common';
import {
  deleteBlockedReason,
  describeDeleteRevisionError,
  describeRollbackError,
  gapLabel,
  revisionGaps,
  hasProgressing,
  healthPill,
  isConcurrentModification,
  revisionAccessibleName,
  revisionMessage,
  rollbackBlockedReason,
  shortMessage,
  sortNewestFirst,
} from './revisionUtils';

const makeRevision = (
  n: number,
  status: Partial<NonNullable<ReleaseBindingRevision['status']>> = {},
): ReleaseBindingRevision =>
  ({
    metadata: { name: `api-dev-r${n}` },
    spec: {
      revision: n,
      cause: 'Deploy',
      componentReleaseName: `api-v${n}`,
      bindingSpec: { owner: { projectName: 'shop', componentName: 'api' } },
    },
    status: { health: 'Healthy', active: false, knownGood: false, ...status },
  } as unknown as ReleaseBindingRevision);

const apiError = (status: number, error: Record<string, unknown>) =>
  ResponseError.fromResponse(
    new Response(JSON.stringify({ error, response: { statusCode: status } }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

describe('healthPill', () => {
  it.each([
    ['Healthy', 'success'],
    ['Progressing', 'pending'],
    ['Degraded', 'warning'],
    ['Failed', 'failed'],
    ['Unknown', 'unknown'],
  ])('maps %s to the %s badge', (health, status) => {
    expect(healthPill(health)).toEqual({ status, label: health });
  });

  it.each([undefined, '', 'Exploded'])('shows %p as Unknown', health => {
    expect(healthPill(health)).toEqual({ status: 'unknown', label: 'Unknown' });
  });
});

describe('sortNewestFirst', () => {
  it('orders by revision number, not by input order or name', () => {
    const revs = [2, 10, 1, 9].map(n => makeRevision(n));
    expect(sortNewestFirst(revs).map(r => r.spec.revision)).toEqual([
      10, 9, 2, 1,
    ]);
  });

  it('does not mutate its input', () => {
    const revs = [makeRevision(1), makeRevision(2)];
    sortNewestFirst(revs);
    expect(revs.map(r => r.spec.revision)).toEqual([1, 2]);
  });
});

describe('hasProgressing', () => {
  it('is true only when some revision is Progressing', () => {
    expect(hasProgressing([makeRevision(1)])).toBe(false);
    expect(
      hasProgressing([
        makeRevision(2, { health: 'Progressing' }),
        makeRevision(1),
      ]),
    ).toBe(true);
    expect(hasProgressing(undefined)).toBe(false);
  });

  it('is true for a revision whose status the controller has not written yet', () => {
    const unobserved = {
      ...makeRevision(3),
      status: undefined,
    } as unknown as ReleaseBindingRevision;
    expect(hasProgressing([unobserved, makeRevision(2)])).toBe(true);
  });

  // A revision keeps the health it had when it stopped being active. One
  // deactivated mid-rollout (for example when GitOps re-applies the release
  // Git declares right after a rollback) stays Progressing for good, and
  // must not keep the list polling.
  it('ignores an inactive revision frozen at Progressing once another is active', () => {
    expect(
      hasProgressing([
        makeRevision(2, { active: true }),
        makeRevision(1, { health: 'Progressing' }),
      ]),
    ).toBe(false);
  });

  it('follows the active revision while it settles', () => {
    expect(
      hasProgressing([
        makeRevision(2, { active: true, health: 'Progressing' }),
        makeRevision(1),
      ]),
    ).toBe(true);
    const activeUnobserved = {
      ...makeRevision(3),
      status: { active: true },
    } as unknown as ReleaseBindingRevision;
    expect(hasProgressing([activeUnobserved, makeRevision(2)])).toBe(true);
  });
});

describe('rollbackBlockedReason', () => {
  const allowed = {
    releaseNames: new Set(['api-v1', 'api-v2']),
    canRollback: true,
    deniedTooltip: '',
  };

  it('allows a non-active revision whose release exists', () => {
    expect(rollbackBlockedReason(makeRevision(1), allowed)).toBeNull();
  });

  it('blocks a revision whose release is gone', () => {
    expect(rollbackBlockedReason(makeRevision(3), allowed)).toBe(
      'Release api-v3 has been deleted, so api-r3 can no longer be restored.',
    );
  });

  it('trusts the server while releases are unknown', () => {
    expect(
      rollbackBlockedReason(makeRevision(3), {
        ...allowed,
        releaseNames: null,
      }),
    ).toBeNull();
  });

  it('blocks the active revision', () => {
    expect(
      rollbackBlockedReason(makeRevision(2, { active: true }), allowed),
    ).toBe('api-r2 is already active.');
  });

  it('puts a missing permission first', () => {
    expect(
      rollbackBlockedReason(makeRevision(3), {
        ...allowed,
        canRollback: false,
        deniedTooltip: 'No rollback for you',
      }),
    ).toBe('No rollback for you');
  });

  it('asks for a selection', () => {
    expect(rollbackBlockedReason(undefined, allowed)).toBe(
      'Select a revision to roll back to.',
    );
  });
});

describe('describeRollbackError', () => {
  it('explains a 403', async () => {
    const err = await apiError(403, { name: 'NotAllowedError', message: 'no' });
    expect(describeRollbackError(err)).toBe(
      'You do not have permission to roll back this deployment. Contact your administrator.',
    );
  });

  it('explains a deleted release', async () => {
    const err = await apiError(409, {
      name: 'ConflictError',
      message: 'ComponentRelease api-v1 has been deleted',
      code: 'RELEASE_DELETED',
    });
    expect(describeRollbackError(err)).toBe(
      'The release this revision deployed has been deleted, so it can no longer be restored. ComponentRelease api-v1 has been deleted',
    );
    expect(isConcurrentModification(err)).toBe(false);
  });

  it('explains a concurrent change', async () => {
    const err = await apiError(409, {
      name: 'ConflictError',
      message: 'binding changed',
      code: 'CONCURRENT_MODIFICATION',
    });
    expect(describeRollbackError(err)).toMatch(
      /^The deployment changed while you were reviewing the rollback/,
    );
    expect(isConcurrentModification(err)).toBe(true);
  });

  it('keeps the detail of a 409 without a code', async () => {
    const err = await apiError(409, { name: 'ConflictError', message: 'odd' });
    expect(describeRollbackError(err)).toBe(
      'The rollback conflicts with the current deployment: odd',
    );
  });

  it('falls back to the error message', () => {
    expect(describeRollbackError(new Error('boom'))).toBe(
      'Rollback failed: boom',
    );
  });
});

describe('revisionAccessibleName', () => {
  it('spells out every marker', () => {
    expect(
      revisionAccessibleName(
        makeRevision(3, {
          health: 'Progressing',
          active: true,
          knownGood: true,
        }),
      ),
    ).toBe('api-r3, Progressing, cause Deploy, active, known good');
    expect(revisionAccessibleName(makeRevision(1))).toBe(
      'api-r1, Healthy, cause Deploy',
    );
  });
});

describe('deleteBlockedReason', () => {
  const allowed = { canDelete: true, deniedTooltip: '' };
  const history = [
    makeRevision(4, { active: true }),
    makeRevision(3, { health: 'Failed' }),
    makeRevision(2, { knownGood: true }),
    makeRevision(1, { knownGood: true }),
  ];

  it('allows an inactive revision that is not protected', () => {
    expect(deleteBlockedReason(history[1], history, allowed)).toBeNull();
    expect(deleteBlockedReason(history[3], history, allowed)).toBeNull();
  });

  it('protects the active revision', () => {
    expect(deleteBlockedReason(history[0], history, allowed)).toBe(
      'api-r4 is currently active and cannot be deleted.',
    );
  });

  it('protects the newest known-good revision', () => {
    expect(deleteBlockedReason(history[2], history, allowed)).toMatch(
      /newest known-good revision/,
    );
  });

  it('does not protect a revision annotated openchoreo.dev/keep', () => {
    const annotated = makeRevision(3, { health: 'Failed' });
    annotated.metadata.annotations = { 'openchoreo.dev/keep': 'true' };
    expect(deleteBlockedReason(annotated, history, allowed)).toBeNull();
  });

  it('explains a missing permission first', () => {
    expect(
      deleteBlockedReason(history[1], history, {
        canDelete: false,
        deniedTooltip: 'No delete for you',
      }),
    ).toBe('No delete for you');
  });
});

describe('describeDeleteRevisionError', () => {
  it('passes the server reason for a protected revision through', async () => {
    expect(
      describeDeleteRevisionError(
        await apiError(409, {
          message: 'Cannot delete revision 4 because it is currently active',
          code: 'REVISION_PROTECTED',
        }),
      ),
    ).toBe('Cannot delete revision 4 because it is currently active');
  });

  it('explains a concurrent activation', async () => {
    expect(
      describeDeleteRevisionError(
        await apiError(409, {
          message: 'changed',
          code: 'CONCURRENT_MODIFICATION',
        }),
      ),
    ).toMatch(/changed while it was being deleted/);
  });

  it('explains a revision already deleted and a denial', async () => {
    expect(
      describeDeleteRevisionError(
        await apiError(404, { message: 'nope', code: 'NOT_FOUND' }),
      ),
    ).toBe('This revision no longer exists: it has already been deleted.');
    expect(
      describeDeleteRevisionError(
        await apiError(403, { message: 'nope', code: 'FORBIDDEN' }),
      ),
    ).toMatch(/permission/);
  });
});

describe('describeRollbackError for a deleted revision', () => {
  it('says the revision was deleted', async () => {
    expect(
      describeRollbackError(
        await apiError(404, {
          message: 'revision not found',
          code: 'NOT_FOUND',
        }),
      ),
    ).toBe(
      'This revision no longer exists: it has been deleted, so it can no longer be rolled back to.',
    );
  });
});

describe('revisionGaps', () => {
  it('finds the runs of missing numbers between revisions', () => {
    const gaps = revisionGaps([
      makeRevision(9),
      makeRevision(8),
      makeRevision(5),
      makeRevision(3),
    ]);
    expect([...gaps.entries()]).toEqual([
      [8, { from: 6, to: 7 }],
      [5, { from: 4, to: 4 }],
    ]);
    expect(gapLabel({ from: 6, to: 7 })).toBe('r6–r7');
    expect(gapLabel({ from: 4, to: 4 })).toBe('r4');
  });

  it('reports nothing for a history without gaps or below the oldest', () => {
    expect(revisionGaps([makeRevision(3), makeRevision(2)]).size).toBe(0);
  });
});

describe('change messages', () => {
  const withMessage = (message?: string) =>
    ({
      spec: { revision: 1, cause: 'Deploy', message },
    } as unknown as ReleaseBindingRevision);

  it('reads a revision message, treating blank as none', () => {
    expect(revisionMessage(withMessage('Fix checkout timeout'))).toBe(
      'Fix checkout timeout',
    );
    expect(revisionMessage(withMessage('   '))).toBeUndefined();
    expect(revisionMessage(withMessage(undefined))).toBeUndefined();
  });

  it('shortens a message to one line', () => {
    expect(shortMessage('Roll back\n  payments')).toBe('Roll back payments');
    const long = 'é'.repeat(80);
    expect(Array.from(shortMessage(long))).toHaveLength(60);
    expect(shortMessage(long).endsWith('…')).toBe(true);
    expect(shortMessage('short', 10)).toBe('short');
  });
});
