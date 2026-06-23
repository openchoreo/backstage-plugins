import { normalizeActions } from './actionUtils';

const AVAILABLE_ACTIONS = [
  'component:view',
  'component:create',
  'component:update',
  'component:delete',
  'project:view',
  'project:create',
  'logs:view',
];

describe('normalizeActions', () => {
  it('returns the input unchanged when the action catalog has not loaded yet', () => {
    const actions = ['component:view', 'component:create'];
    expect(normalizeActions(actions, [])).toEqual(actions);
  });

  it('collapses a fully-selected category into a category wildcard', () => {
    const actions = [
      'component:view',
      'component:create',
      'component:update',
      'component:delete',
    ];
    expect(normalizeActions(actions, AVAILABLE_ACTIONS)).toEqual([
      'component:*',
    ]);
  });

  it('collapses access to every action into the global wildcard', () => {
    expect(normalizeActions([...AVAILABLE_ACTIONS], AVAILABLE_ACTIONS)).toEqual(
      ['*'],
    );
  });

  it('keeps a partially-selected category as individual actions', () => {
    const actions = ['component:view', 'component:create'];
    expect(normalizeActions(actions, AVAILABLE_ACTIONS)).toEqual([
      'component:view',
      'component:create',
    ]);
  });

  it('is idempotent for already-collapsed wildcards', () => {
    expect(normalizeActions(['component:*'], AVAILABLE_ACTIONS)).toEqual([
      'component:*',
    ]);
    expect(normalizeActions(['*'], AVAILABLE_ACTIONS)).toEqual(['*']);
  });

  it('preserves stale actions absent from the catalog instead of dropping them', () => {
    // Unknown category and unknown action within a known category must survive
    // the normalization round-trip so saving an edited role keeps them.
    expect(
      normalizeActions(
        ['component:view', 'component:frobnicate', 'foo:bar', 'foo:*'],
        AVAILABLE_ACTIONS,
      ),
    ).toEqual(['component:view', 'component:frobnicate', 'foo:bar', 'foo:*']);
  });

  it('does not duplicate a known category wildcard when preserving', () => {
    expect(
      normalizeActions(
        [
          'component:view',
          'component:create',
          'component:update',
          'component:delete',
          'foo:bar',
        ],
        AVAILABLE_ACTIONS,
      ),
    ).toEqual(['component:*', 'foo:bar']);
  });

  it('collapses some categories while leaving partial ones expanded', () => {
    const actions = [
      'component:view',
      'component:create',
      'component:update',
      'component:delete',
      'project:view',
    ];
    expect(normalizeActions(actions, AVAILABLE_ACTIONS)).toEqual([
      'component:*',
      'project:view',
    ]);
  });
});
