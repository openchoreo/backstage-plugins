import { resolvePackagePath } from '@backstage/backend-plugin-api';
import { TestDatabases } from '@backstage/backend-test-utils';
import type { TechInsightJsonRuleCheck } from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import { DynamicCheckRegistry } from './DynamicCheckRegistry';

jest.setTimeout(60_000);

const databases = TestDatabases.create({ ids: ['SQLITE_3'] });

async function createRegistry() {
  const knex = await databases.init('SQLITE_3');
  await knex.migrate.latest({
    directory: resolvePackagePath(
      '@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks',
      'migrations',
    ),
    tableName: 'dynamic_checks_migrations',
  });
  return new DynamicCheckRegistry(knex);
}

const check: TechInsightJsonRuleCheck = {
  id: 'check-1',
  type: 'json-rules-engine',
  name: 'Default branch protected',
  description: 'The default branch has protection rules.',
  factIds: ['githubBranchProtectionFactRetriever'],
  metadata: { rank: 1, category: 'Security', solution: 'Protect it.' },
  rule: {
    conditions: {
      all: [{ fact: 'branchProtected', operator: 'equal', value: true }],
    },
  },
};

describe('DynamicCheckRegistry', () => {
  it('round-trips links and success and failure metadata', async () => {
    const registry = await createRegistry();
    await registry.register({
      ...check,
      links: [{ title: 'Branch protection', url: 'https://docs.github.com/' }],
      successMetadata: { message: 'Protected.' },
      failureMetadata: { message: 'Not protected.' },
    });

    await expect(registry.get('check-1')).resolves.toEqual({
      ...check,
      filter: undefined,
      links: [{ title: 'Branch protection', url: 'https://docs.github.com/' }],
      successMetadata: { message: 'Protected.' },
      failureMetadata: { message: 'Not protected.' },
    });
  });

  it('clears links and result metadata on update', async () => {
    const registry = await createRegistry();
    await registry.register({
      ...check,
      links: [{ title: 'Docs', url: 'https://example.com/' }],
      failureMetadata: { message: 'Not protected.' },
    });
    await registry.update('check-1', check);

    const stored = await registry.get('check-1');
    expect(stored.links).toBeUndefined();
    expect(stored.failureMetadata).toBeUndefined();
    expect(stored.metadata).toEqual(check.metadata);
  });

  it('evaluates only published checks', async () => {
    const registry = await createRegistry();
    await registry.register(check);
    await expect(registry.list()).resolves.toEqual([]);

    await expect(registry.getAllPublished(['check-1'])).resolves.toEqual([]);
    await expect(registry.getStatus('check-1')).resolves.toBe('draft');

    await registry.publish('check-1');
    await expect(registry.list()).resolves.toHaveLength(1);
    await expect(registry.getAllPublished(['check-1'])).resolves.toHaveLength(
      1,
    );
    await expect(registry.getStatus('check-1')).resolves.toBe('published');
    await expect(registry.listAll()).resolves.toEqual([
      expect.objectContaining({ id: 'check-1', status: 'published' }),
    ]);
  });
});
