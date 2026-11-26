import {
  createServiceFactory,
  resolvePackagePath,
} from '@backstage/backend-plugin-api';
import {
  mockServices,
  startTestBackend,
  TestDatabases,
} from '@backstage/backend-test-utils';
import {
  FactRetriever,
  techInsightsFactRetrieversExtensionPoint,
  type TechInsightsStore,
} from '@backstage-community/plugin-tech-insights-node';
import { JsonRulesEngineFactCheckerFactory } from '@backstage-community/plugin-tech-insights-backend-module-jsonfc';
import githubFacts from '@openchoreo/backstage-plugin-tech-insights-backend-module-github';
import openChoreoFacts from '@openchoreo/backstage-plugin-tech-insights-backend-module-openchoreo';
import {
  OpenChoreoTokenService,
  openChoreoTokenServiceRef,
} from '@openchoreo/openchoreo-auth';
import { DynamicCheckRegistry } from './DynamicCheckRegistry';
import { StaticCheckRegistry } from './EvaluableCheckRegistry';
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

/** The schemas of the retrievers the starter checks read, as their modules register them. */
async function retrieverSchemas() {
  const retrievers: FactRetriever[] = [];
  const backend = await startTestBackend({
    extensionPoints: [
      [
        techInsightsFactRetrieversExtensionPoint,
        {
          addFactRetrievers: added => {
            retrievers.push(...Object.values(added));
          },
        },
      ],
    ],
    features: [
      githubFacts,
      openChoreoFacts,
      createServiceFactory({
        service: openChoreoTokenServiceRef,
        deps: {},
        factory: () => ({} as OpenChoreoTokenService),
      }),
    ],
  });
  await backend.stop();
  return retrievers.map(retriever => ({
    id: retriever.id,
    ...retriever.schema,
  }));
}

const SAMPLE_ID = 'openchoreo-starter-image-pinned';
const SECRETS_ID = 'openchoreo-starter-no-plaintext-secrets';

const everyEnvironment = (field: string, value: unknown) => ({
  conditions: {
    all: [
      {
        fact: 'openchoreoEnvironmentDeployments',
        path: `$[*].${field}`,
        operator: 'everyFact:equal',
        value,
      },
      { fact: 'openchoreoReleasesResolved', operator: 'equal', value: true },
    ],
  },
});

describe('seedOpenChoreoStarterChecks', () => {
  it('adds the starter checks, published', async () => {
    const { knex, registry } = await createDatabase();
    await seedOpenChoreoStarterChecks(knex);

    const checks = await registry.listAll();
    expect(checks).toHaveLength(9);
    expect(checks.every(check => check.status === 'published')).toBe(true);
    expect(
      checks.every(check => check.id.startsWith('openchoreo-starter-')),
    ).toBe(true);
    expect(await registry.get(SAMPLE_ID)).toMatchObject({
      type: 'json-rules-engine',
      factIds: ['openchoreoDeploymentFactRetriever'],
      filter: { kind: ['Component', 'ReleaseLine'] },
      metadata: { rank: 2, category: 'Security' },
    });
  });

  it('builds every starter rule from facts the retrievers report', async () => {
    const { knex, registry } = await createDatabase();
    await seedOpenChoreoStarterChecks(knex);
    const schemas = await retrieverSchemas();
    const validator = new CheckValidator({
      getLatestSchemas: async () => schemas,
    } as any);

    const problems = await validator.problemsOfEach(await registry.listAll());
    expect(problems.flat()).toEqual([]);
  });

  it('runs every check on components on their release lines too', async () => {
    const { knex, registry } = await createDatabase();
    await seedOpenChoreoStarterChecks(knex);

    const kinds = (check: { filter?: unknown }) =>
      [(check.filter as { kind?: string | string[] }).kind ?? []].flat();
    const onComponents = (await registry.listAll()).filter(check =>
      kinds(check).includes('Component'),
    );
    expect(onComponents).not.toHaveLength(0);
    expect(
      onComponents
        .filter(check => !kinds(check).includes('ReleaseLine'))
        .map(check => check.id),
    ).toEqual([]);
  });

  it('seeds once, so edits, unpublishing and deletion stick', async () => {
    const { knex, registry } = await createDatabase();
    await seedOpenChoreoStarterChecks(knex);

    const pinned = await registry.get(SAMPLE_ID);
    await registry.update(SAMPLE_ID, { ...pinned, name: 'Edited' });
    await registry.unpublish('openchoreo-starter-no-plaintext-secrets');
    await registry.delete('openchoreo-starter-gh-codeowners');

    await seedOpenChoreoStarterChecks(knex);

    expect((await registry.get(SAMPLE_ID)).name).toBe('Edited');
    expect(
      await registry.getStatus('openchoreo-starter-no-plaintext-secrets'),
    ).toBe('draft');
    await expect(
      registry.get('openchoreo-starter-gh-codeowners'),
    ).rejects.toThrow(/not registered/);
    expect(await registry.listAll()).toHaveLength(8);
  });

  it('keeps a check someone already created with a starter id', async () => {
    const { knex, registry } = await createDatabase();
    await registry.register({
      id: SAMPLE_ID,
      type: 'json-rules-engine',
      name: 'Their own check',
      description: 'A check created before the starter checks.',
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
    expect(await registry.listAll()).toHaveLength(9);
  });

  it('judges plain secrets and image pinning in every environment', async () => {
    const { knex, registry } = await createDatabase();
    await seedOpenChoreoStarterChecks(knex);

    expect((await registry.get(SECRETS_ID)).rule).toEqual(
      everyEnvironment('plainTextSecretEnvVarCount', 0),
    );
    expect((await registry.get(SAMPLE_ID)).rule).toEqual(
      everyEnvironment('isImagePinned', true),
    );
  });
});

describe('evaluating the environment starter checks with jsonfc', () => {
  const ENTITY_REF = 'component:default/greeter';
  const DEPLOYMENT = 'openchoreoDeploymentFactRetriever';

  async function evaluate(facts: Record<string, unknown>) {
    const { knex, registry } = await createDatabase();
    await seedOpenChoreoStarterChecks(knex);
    const checks = await registry.getAllPublished([SECRETS_ID, SAMPLE_ID]);
    const schemas = (await retrieverSchemas()).filter(s => s.id === DEPLOYMENT);
    const store = {
      getLatestSchemas: async () => schemas,
      getLatestFactsByIds: async () => ({
        [DEPLOYMENT]: {
          id: DEPLOYMENT,
          entity: { namespace: 'default', kind: 'Component', name: 'greeter' },
          timestamp: { toISO: () => '2026-11-24T00:00:00.000Z' },
          version: '0.3.0',
          facts,
        },
      }),
    } as unknown as TechInsightsStore;
    const checker = new JsonRulesEngineFactCheckerFactory({
      checks: [],
      logger: mockServices.logger.mock(),
      checkRegistry: new StaticCheckRegistry(checks),
    }).construct(store);
    const results = await checker.runChecks(ENTITY_REF);
    return Object.fromEntries(results.map(r => [r.check.id, r.result]));
  }

  const entry = (fields: Record<string, unknown>) => ({
    environment: 'development',
    isProduction: false,
    isReleaseSynced: true,
    isReady: true,
    ...fields,
  });

  // An undefined releasesResolved leaves the fact out.
  it.each([
    [
      'every environment clean and pinned',
      [
        entry({ plainTextSecretEnvVarCount: 0, isImagePinned: true }),
        entry({
          environment: 'production',
          isProduction: true,
          plainTextSecretEnvVarCount: 0,
          isImagePinned: true,
        }),
      ],
      true,
      { [SECRETS_ID]: true, [SAMPLE_ID]: true },
    ],
    [
      'one environment with a plain secret on a moving tag',
      [
        entry({ plainTextSecretEnvVarCount: 0, isImagePinned: true }),
        entry({
          environment: 'production',
          isProduction: true,
          plainTextSecretEnvVarCount: 1,
          isImagePinned: false,
        }),
      ],
      true,
      { [SECRETS_ID]: false, [SAMPLE_ID]: false },
    ],
    [
      'a single passing environment',
      [entry({ plainTextSecretEnvVarCount: 0, isImagePinned: true })],
      true,
      { [SECRETS_ID]: true, [SAMPLE_ID]: true },
    ],
    [
      'a single failing environment',
      [entry({ plainTextSecretEnvVarCount: 2, isImagePinned: false })],
      true,
      { [SECRETS_ID]: false, [SAMPLE_ID]: false },
    ],
    [
      'an environment whose release could not be read beside a passing one',
      [
        entry({ plainTextSecretEnvVarCount: 0, isImagePinned: true }),
        entry({ environment: 'production', isProduction: true }),
      ],
      undefined,
      {},
    ],
    [
      'an environment whose release could not be read beside a failing one',
      [
        entry({ plainTextSecretEnvVarCount: 1, isImagePinned: false }),
        entry({ environment: 'production', isProduction: true }),
      ],
      undefined,
      {},
    ],
    [
      'no environment whose release could be read',
      [entry({}), entry({ environment: 'production', isProduction: true })],
      undefined,
      {},
    ],
    [
      'an empty list, which everyFact fails',
      [],
      true,
      { [SECRETS_ID]: false, [SAMPLE_ID]: false },
    ],
    [
      'null, the value of an unresolved component',
      null,
      null,
      { [SECRETS_ID]: false, [SAMPLE_ID]: false },
    ],
  ])('judges %s', async (_label, deployments, releasesResolved, expected) => {
    await expect(
      evaluate({
        openchoreoComponentResolved: deployments !== null,
        openchoreoEnvironmentDeployments: deployments,
        ...(releasesResolved !== undefined && {
          openchoreoReleasesResolved: releasesResolved,
        }),
      }),
    ).resolves.toEqual(expected);
  });

  it('skips both checks for a line that reports no list', async () => {
    await expect(
      evaluate({ openchoreoComponentResolved: true }),
    ).resolves.toEqual({});
  });
});
