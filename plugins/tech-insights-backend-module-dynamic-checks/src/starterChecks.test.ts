import { resolvePackagePath } from '@backstage/backend-plugin-api';
import { TestDatabases } from '@backstage/backend-test-utils';
import { DynamicCheckRegistry } from './DynamicCheckRegistry';
import { seedOpenChoreoStarterChecks } from './starterChecks';
import { CheckValidator } from './validation';

jest.setTimeout(60_000);

const databases = TestDatabases.create({ ids: ['SQLITE_3'] });

async function createDatabase() {
  const knex = await databases.init('SQLITE_3');
  await knex.migrate.latest({
    directory: resolvePackagePath(
      '@openchoreo/backstage-plugin-tech-insights-backend-module-dynamic-checks',
      'migrations',
    ),
    tableName: 'dynamic_checks_migrations',
  });
  return { knex, registry: new DynamicCheckRegistry(knex) };
}

const SAMPLE_ID = 'openchoreo-starter-image-pinned';

describe('seedOpenChoreoStarterChecks', () => {
  it('adds the starter checks, published', async () => {
    const { knex, registry } = await createDatabase();
    await seedOpenChoreoStarterChecks(knex);

    const checks = await registry.listAll();
    expect(checks).toHaveLength(13);
    expect(checks.every(check => check.status === 'published')).toBe(true);
    expect(
      checks.every(check => check.id.startsWith('openchoreo-starter-')),
    ).toBe(true);
    expect(await registry.get(SAMPLE_ID)).toMatchObject({
      type: 'json-rules-engine',
      factIds: ['openchoreoDeploymentFactRetriever'],
      filter: { kind: 'Component' },
      metadata: { rank: 2, category: 'Security' },
    });
  });

  it('builds every starter rule', async () => {
    const { knex, registry } = await createDatabase();
    await seedOpenChoreoStarterChecks(knex);
    const factsByRetriever: Record<string, string[]> = {};
    for (const check of await registry.listAll()) {
      for (const id of check.factIds) {
        factsByRetriever[id] = [
          ...(factsByRetriever[id] ?? []),
          ...JSON.stringify(check.rule)
            .match(/"fact":"([^"]+)"/g)!
            .map(match => match.slice(8, -1)),
        ];
      }
    }
    const schemas = Object.entries(factsByRetriever).map(([id, facts]) => ({
      id,
      ...Object.fromEntries(facts.map(fact => [fact, { type: 'boolean' }])),
    }));
    const validator = new CheckValidator({
      getLatestSchemas: async () => schemas,
    } as any);

    const problems = await validator.problemsOfEach(await registry.listAll());
    expect(problems.flat()).toEqual([]);
  });

  it('seeds once, so edits, unpublishing and deletion stick', async () => {
    const { knex, registry } = await createDatabase();
    await seedOpenChoreoStarterChecks(knex);

    const pinned = await registry.get(SAMPLE_ID);
    await registry.update(SAMPLE_ID, { ...pinned, name: 'Edited' });
    await registry.unpublish('openchoreo-starter-in-production');
    await registry.delete('openchoreo-starter-gh-codeowners');

    await seedOpenChoreoStarterChecks(knex);

    expect((await registry.get(SAMPLE_ID)).name).toBe('Edited');
    expect(await registry.getStatus('openchoreo-starter-in-production')).toBe(
      'draft',
    );
    await expect(
      registry.get('openchoreo-starter-gh-codeowners'),
    ).rejects.toThrow(/not registered/);
    expect(await registry.listAll()).toHaveLength(12);
  });

  it('keeps a check someone already created with a starter id', async () => {
    const { knex, registry } = await createDatabase();
    await registry.register({
      id: SAMPLE_ID,
      type: 'json-rules-engine',
      name: 'Their own check',
      factIds: ['openchoreoDeploymentFactRetriever'],
      rule: {
        conditions: {
          all: [
            { fact: 'openchoreoImagePinned', operator: 'equal', value: true },
          ],
        },
      },
    });

    await seedOpenChoreoStarterChecks(knex);

    expect((await registry.get(SAMPLE_ID)).name).toBe('Their own check');
    expect(await registry.getStatus(SAMPLE_ID)).toBe('draft');
    expect(await registry.listAll()).toHaveLength(13);
  });
});
