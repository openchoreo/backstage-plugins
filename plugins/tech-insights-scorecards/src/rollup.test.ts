import { Rank } from '@backstage-community/plugin-tech-insights-maturity-common';
import {
  catalogProgress,
  checkSummaries,
  kindSummaries,
  tierCounts,
} from './breakdown';
import { childRefsOf, createRollup, normalizeRef } from './rollup';
import { entity, result } from './testUtils';

const domain = entity('Domain', 'default', [
  'system:default/payments',
  'environment:default/dev',
]);
const system = entity('System', 'payments', [
  'component:default/api',
  'component:default/worker',
]);
const api = entity('Component', 'api');
const worker = entity('Component', 'worker');
const dev = entity('Environment', 'dev');

const entities = new Map(
  [domain, system, api, worker, dev].map(e => [normalizeRef(e), e]),
);
const results = new Map([
  ['system:default/payments', [result('system-tagged', Rank.Silver, true)]],
  [
    'component:default/api',
    [result('desc', Rank.Bronze, true), result('owner', Rank.Silver, true)],
  ],
  [
    'component:default/worker',
    [result('desc', Rank.Bronze, false), result('owner', Rank.Silver, true)],
  ],
]);

describe('createRollup', () => {
  const rollup = createRollup(entities, results);

  it('nests a Domain’s Systems and their components one level at a time', () => {
    const root = rollup('domain:default/default')!;
    expect(root.children.map(c => c.ref)).toEqual([
      'system:default/payments',
      'environment:default/dev',
    ]);
    expect(root.children[0].children.map(c => c.ref)).toEqual([
      'component:default/worker',
      'component:default/api',
    ]);
    expect(root.descendantCount).toBe(4);
  });

  it('combines an entity’s own checks with everything beneath it', () => {
    const payments = rollup('system:default/payments')!;
    expect(payments.ownChecks).toHaveLength(1);
    expect(payments.progress).toMatchObject({
      passedChecks: 4,
      totalChecks: 5,
    });
    // The worker's failing Bronze check caps the combined tier at Stone.
    expect(payments.rank).toBe(Rank.Stone);
    expect(rollup('domain:default/default')!.rank).toBe(Rank.Stone);
  });

  it('gives the same node wherever the entity is reached', () => {
    const fromDomain = rollup('domain:default/default')!.children[0];
    expect(fromDomain).toBe(rollup('system:default/payments'));
  });

  it('marks an entity no check covers as not scored', () => {
    const env = rollup('environment:default/dev')!;
    expect(env.scored).toBe(false);
    expect(env.progress.totalChecks).toBe(0);
  });

  it('counts an entity reached twice beneath one parent once', () => {
    const group = entity('Group', 'team', [
      'system:default/payments',
      'component:default/api',
    ]);
    group.relations = group.relations!.map(r => ({ ...r, type: 'ownerOf' }));
    const withGroup = new Map(entities).set(normalizeRef(group), group);
    const node = createRollup(withGroup, results)('group:default/team')!;
    expect(node.progress.totalChecks).toBe(5);
    expect(node.descendantCount).toBe(3);
  });

  it('stops at a relation cycle', () => {
    const a = entity('System', 'a', ['system:default/b']);
    const b = entity('System', 'b', ['system:default/a']);
    const cyclic = new Map([a, b].map(e => [normalizeRef(e), e]));
    const node = createRollup(cyclic, new Map())('system:default/a')!;
    expect(node.children[0].ref).toBe('system:default/b');
    expect(node.children[0].children).toEqual([]);
  });

  it('normalizes refs from relations', () => {
    const mixed = entity('System', 'payments', ['Component:Default/api']);
    expect(childRefsOf(mixed)).toEqual(['component:default/api']);
  });
});

describe('catalog totals', () => {
  const rollup = createRollup(entities, results);
  const nodes = [domain, system, api, worker].map(
    e => rollup(normalizeRef(e))!,
  );

  it('counts each entity’s own results once', () => {
    expect(catalogProgress(nodes)).toMatchObject({
      passedChecks: 4,
      totalChecks: 5,
      scoredEntities: 3,
    });
  });

  it('counts checks per entity they ran against', () => {
    const desc = checkSummaries(nodes).find(s => s.check.id === 'desc')!;
    expect(desc.passing.map(n => n.ref)).toEqual(['component:default/api']);
    expect(desc.failing.map(n => n.ref)).toEqual(['component:default/worker']);
  });

  it('lists checks lowest tier first, then by failures', () => {
    expect(checkSummaries(nodes).map(s => s.check.id)).toEqual([
      'desc',
      'owner',
      'system-tagged',
    ]);
  });

  it('gives a kind with checks of its own a pass rate', () => {
    const [components, systems] = kindSummaries(nodes, ['Component', 'System']);
    expect(components).toMatchObject({
      kind: 'Component',
      notScored: 0,
      progress: { passedChecks: 3, totalChecks: 4 },
    });
    expect(components.nodes.map(n => n.ref)).toEqual([
      'component:default/api',
      'component:default/worker',
    ]);
    expect(components.tiers[Rank.Stone]).toBe(1);
    expect(components.tiers[Rank.Silver]).toBe(1);
    expect(systems.progress).toMatchObject({ totalChecks: 1 });
  });

  it('gives a kind whose tiers only roll up no pass rate', () => {
    const [domains] = kindSummaries(nodes, ['Domain']);
    expect(domains.progress).toBeUndefined();
    expect(domains.tiers[Rank.Stone]).toBe(1);
  });

  it('leaves unscored entities out of the tier counts', () => {
    const counts = tierCounts([...nodes, rollup('environment:default/dev')!]);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(4);
  });
});
