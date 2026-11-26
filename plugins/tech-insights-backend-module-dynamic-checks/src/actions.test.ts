import type { BackstageCredentials } from '@backstage/backend-plugin-api';
import { mockCredentials, mockServices } from '@backstage/backend-test-utils';
import { actionsRegistryServiceMock } from '@backstage/backend-test-utils/alpha';
import { NotFoundError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import { registerCheckActions } from './actions';
import { dryRunCheck } from './dryRun';
import type { DynamicCheckRegistry } from './DynamicCheckRegistry';

jest.mock('./dryRun', () => ({ dryRunCheck: jest.fn() }));
const dryRunCheckMock = dryRunCheck as jest.MockedFunction<typeof dryRunCheck>;

const conditions = {
  all: [{ fact: 'githubVisibility', operator: 'equal', value: 'private' }],
};

// The check as a tool caller sends it: conditions as a JSON string.
const toolCheck = {
  name: 'Repo must be private',
  description: '',
  factIds: ['githubRepoMetadataFactRetriever'],
  rule: { conditions: JSON.stringify(conditions) },
};

// create_check / update_check input: the check plus metadata, here with
// every metadata field left unset.
const keepMetadata = { category: '', rank: 0, solution: '' };
const toolSave = { ...toolCheck, metadata: keepMetadata };

// The same check as the module stores and evaluates it.
const draftCheck = {
  type: 'json-rules-engine',
  name: 'Repo must be private',
  description: '',
  factIds: ['githubRepoMetadataFactRetriever'],
  rule: { conditions },
};

const user = mockCredentials.user();
const agent = mockCredentials.service('external:mcp-dev');

// A saved check with the fields the write actions must not touch.
const savedCheck = {
  ...draftCheck,
  id: 'c1',
  name: 'Repo must be public',
  rule: {
    conditions: {
      all: [{ fact: 'githubVisibility', operator: 'equal', value: 'public' }],
    },
  },
  metadata: {
    category: 'security',
    rank: 2,
    solution: 'Make the repo public.',
  },
  links: [{ title: 'Docs', url: 'https://example.com' }],
};

function setup({ allow = true }: { allow?: boolean } = {}) {
  const registry = {
    listAll: jest.fn(),
    register: jest.fn(async (check: any) => check),
    get: jest.fn(async (id: string) => {
      if (id !== savedCheck.id) {
        throw new NotFoundError(`Check '${id}' is not registered.`);
      }
      return savedCheck;
    }),
    getStatus: jest.fn(async () => 'draft'),
    update: jest.fn(async (_id: string, check: any) => check),
    publish: jest.fn(async () => undefined),
    unpublish: jest.fn(async () => undefined),
  };
  const store = {
    getLatestSchemas: jest.fn(async (): Promise<any[]> => []),
    getLatestFactsByIds: jest.fn(),
  };
  const validator = { problemsOf: jest.fn(async (): Promise<any[]> => []) };
  const catalog = {
    getEntityByRef: jest.fn(async () => ({ kind: 'Component' })),
  };
  const permissions = mockServices.permissions.mock({
    authorize: jest.fn(async () => [
      { result: allow ? AuthorizeResult.ALLOW : AuthorizeResult.DENY },
    ]) as any,
  });
  const actionsRegistry = actionsRegistryServiceMock({
    logger: mockServices.logger.mock(),
  });
  registerCheckActions({
    actionsRegistry,
    registry: registry as unknown as DynamicCheckRegistry,
    catalog: catalog as any,
    auth: mockServices.auth(),
    permissions,
    getEvaluation: () => ({ store, validator, checker: {} } as any),
  });
  const invoke = (
    name: string,
    input: object,
    credentials: BackstageCredentials = agent,
  ) =>
    actionsRegistry.invoke({
      id: `test:${name}`,
      input: input as any,
      credentials,
    });
  return {
    actionsRegistry,
    registry,
    store,
    validator,
    catalog,
    permissions,
    invoke,
  };
}

const unknownFact = {
  code: 'unknown-fact',
  fact: 'repoVisibility',
  message: 'No registered fact retriever provides a fact named repoVisibility.',
};
const badOperator = {
  code: 'invalid-rule',
  path: '/conditions/all/0/operator',
  message: "The rule can't be evaluated: Unknown operator: equals",
};

/**
 * Collects violations of OpenAI strict function calling rules, which the
 * Portal Assistant enables for every tool: each object lists all its
 * properties as required and sets additionalProperties: false, and there are
 * no free-form ("any") schemas.
 */
function strictModeViolations(schema: any, path = '$'): string[] {
  if (!schema || typeof schema !== 'object') return [];
  if (Object.keys(schema).filter(k => k !== 'description').length === 0) {
    return [`${path}: free-form schema`];
  }
  const errors: string[] = [];
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties ?? {});
    if (schema.additionalProperties !== false) {
      errors.push(`${path}: additionalProperties must be false`);
    }
    const required = new Set(schema.required ?? []);
    keys
      .filter(k => !required.has(k))
      .forEach(k => errors.push(`${path}.${k}: must be required`));
    keys.forEach(k =>
      errors.push(
        ...strictModeViolations(schema.properties[k], `${path}.${k}`),
      ),
    );
  }
  if (schema.type === 'array') {
    errors.push(...strictModeViolations(schema.items, `${path}[]`));
  }
  return errors;
}

describe('registerCheckActions', () => {
  beforeEach(() => dryRunCheckMock.mockReset());

  it('registers exactly the expected tools with explicit flags', () => {
    const { actionsRegistry } = setup();

    const attributes = Object.fromEntries(
      [...actionsRegistry.actions.values()].map(a => [a.name, a.attributes]),
    );
    const readOnly = { readOnly: true, destructive: false, idempotent: true };
    const changesScores = {
      readOnly: false,
      destructive: true,
      idempotent: true,
    };
    expect(attributes).toEqual({
      list_checks: readOnly,
      get_check: readOnly,
      list_fact_schemas: readOnly,
      get_entity_facts: readOnly,
      dry_run_check: readOnly,
      validate_check: readOnly,
      create_check: { readOnly: false, destructive: false, idempotent: false },
      update_check: { readOnly: false, destructive: false, idempotent: true },
      publish_check: changesScores,
      unpublish_check: changesScores,
    });
  });

  // Regression: the Portal Assistant's OpenAI call failed with "Invalid
  // schema for function 'dry_run_check'" when rule.conditions was a
  // free-form object and some fields were optional.
  it('every input schema is valid for OpenAI strict function calling', async () => {
    const { actionsRegistry } = setup();

    const { actions } = await actionsRegistry.list();

    expect(
      actions.flatMap(a => strictModeViolations(a.schema.input, a.name)),
    ).toEqual([]);
  });

  describe('permissions', () => {
    it('applies the read permission to a signed-in user', async () => {
      const { invoke, registry } = setup({ allow: false });

      await expect(invoke('list_checks', {}, user)).rejects.toThrow(
        /don't have the .* permission/,
      );
      expect(registry.listAll).not.toHaveBeenCalled();
    });

    it('lets a service caller (the assistant) read without a user', async () => {
      const { invoke, registry, permissions } = setup();
      registry.listAll.mockResolvedValue([]);

      await invoke('list_checks', {}, agent);

      expect(permissions.authorize).not.toHaveBeenCalled();
    });

    it('rejects callers with no credentials', async () => {
      const { invoke } = setup();

      await expect(
        invoke('list_checks', {}, mockCredentials.none()),
      ).rejects.toThrow(/signed-in user or service/);
    });

    it('never lets a service caller save a check', async () => {
      const { invoke, registry } = setup();

      await expect(invoke('create_check', toolSave, agent)).rejects.toThrow(
        /requires a signed-in user/,
      );
      expect(registry.register).not.toHaveBeenCalled();
    });

    it('applies the manage permission to a user saving a check', async () => {
      const { invoke, registry } = setup({ allow: false });

      await expect(invoke('create_check', toolSave, user)).rejects.toThrow(
        /don't have the .* permission/,
      );
      expect(registry.register).not.toHaveBeenCalled();
    });

    it.each([
      ['update_check', { ...toolSave, id: 'c1' }],
      ['publish_check', { id: 'c1' }],
      ['unpublish_check', { id: 'c1' }],
    ])('never lets a service caller run %s', async (name, input) => {
      const { invoke, registry } = setup();

      await expect(invoke(name, input, agent)).rejects.toThrow(
        /requires a signed-in user/,
      );
      expect(registry.update).not.toHaveBeenCalled();
      expect(registry.publish).not.toHaveBeenCalled();
      expect(registry.unpublish).not.toHaveBeenCalled();
    });

    it.each([
      ['update_check', { ...toolSave, id: 'c1' }],
      ['publish_check', { id: 'c1' }],
      ['unpublish_check', { id: 'c1' }],
    ])(
      'applies the manage permission to a user running %s',
      async (name, input) => {
        const { invoke, registry } = setup({ allow: false });

        await expect(invoke(name, input, user)).rejects.toThrow(
          /don't have the .* permission/,
        );
        expect(registry.update).not.toHaveBeenCalled();
        expect(registry.publish).not.toHaveBeenCalled();
        expect(registry.unpublish).not.toHaveBeenCalled();
      },
    );
  });

  it('list_checks hides leftover dry-run checks', async () => {
    const { invoke, registry } = setup();
    registry.listAll.mockResolvedValue([
      {
        id: 'c1',
        name: 'Real',
        description: 'd',
        factIds: ['f'],
        status: 'draft',
      },
      {
        id: '__dryrun__x',
        name: 'Tmp',
        description: 'd',
        factIds: ['f'],
        status: 'draft',
      },
    ]);

    const { output } = await invoke('list_checks', {});

    expect(output).toEqual({
      checks: [
        {
          id: 'c1',
          name: 'Real',
          description: 'd',
          factIds: ['f'],
          status: 'draft',
        },
      ],
    });
  });

  it('get_check returns the full check, or a hint when the id is unknown', async () => {
    const { invoke, registry } = setup();
    registry.listAll.mockResolvedValue([
      { ...draftCheck, id: 'c1', description: undefined, status: 'published' },
    ]);

    const { output } = await invoke('get_check', { id: 'c1' });
    expect(output).toMatchObject({
      check: {
        id: 'c1',
        description: '',
        status: 'published',
        rule: { conditions },
      },
    });
    await expect(invoke('get_check', { id: 'nope' })).rejects.toThrow(
      /use list_checks/,
    );
  });

  it('list_fact_schemas treats an empty ids array as "all"', async () => {
    const { invoke, store } = setup();
    store.getLatestSchemas.mockResolvedValue([{ id: 'a' }]);

    await invoke('list_fact_schemas', { ids: [] });
    await invoke('list_fact_schemas', { ids: ['a'] });

    expect(store.getLatestSchemas.mock.calls).toEqual([[undefined], [['a']]]);
  });

  it('get_entity_facts normalises the entity ref and returns fact values', async () => {
    const { invoke, store } = setup();
    store.getLatestFactsByIds.mockResolvedValue({
      githubRepoMetadataFactRetriever: {
        id: 'row',
        timestamp: 'ts',
        facts: { githubVisibility: 'public' },
      },
    });

    const { output } = await invoke('get_entity_facts', {
      entityRef: 'component:order-api',
      factIds: ['githubRepoMetadataFactRetriever'],
    });

    expect(store.getLatestFactsByIds).toHaveBeenCalledWith(
      ['githubRepoMetadataFactRetriever'],
      'component:default/order-api',
    );
    expect(output).toEqual({
      facts: {
        githubRepoMetadataFactRetriever: {
          timestamp: 'ts',
          facts: { githubVisibility: 'public' },
        },
      },
    });
  });

  it('get_entity_facts reads no facts of an entity the caller cannot see', async () => {
    const { invoke, store, catalog } = setup();
    catalog.getEntityByRef.mockResolvedValue(undefined as any);

    await expect(
      invoke('get_entity_facts', {
        entityRef: 'component:default/hidden-api',
        factIds: ['githubRepoMetadataFactRetriever'],
      }),
    ).rejects.toThrow('No entity component:default/hidden-api in the catalog.');

    expect(catalog.getEntityByRef).toHaveBeenCalledWith(
      'component:default/hidden-api',
      { credentials: agent },
    );
    expect(store.getLatestFactsByIds).not.toHaveBeenCalled();
  });

  describe('dry_run_check', () => {
    const input = {
      entityRef: 'component:default/order-api',
      check: toolCheck,
    };

    it('reports a failure as a final result with the actual values', async () => {
      const { invoke } = setup();
      dryRunCheckMock.mockResolvedValue({
        status: 'failed',
        entityRef: 'component:default/order-api',
        reasons: [],
        collectedAt: {},
        conditions: {
          all: [
            {
              fact: 'githubVisibility',
              operator: 'equal',
              value: 'private',
              factResult: 'public',
              result: false,
            },
          ],
        },
      });

      const { output } = await invoke('dry_run_check', input);

      expect(output).toEqual({
        status: 'failed',
        passed: false,
        summary:
          'The check was evaluated successfully: component:default/order-api does NOT meet this rule ' +
          '(githubVisibility = "public"). This is the final result — report it; do not change the rule to make it pass.',
        factValues: { githubVisibility: 'public' },
        reasons: [],
      });
      expect(dryRunCheckMock).toHaveBeenCalledWith(
        expect.objectContaining({
          check: draftCheck,
          entityRef: 'component:default/order-api',
        }),
      );
    });

    it('turns an invalid check into an input error with the reasons', async () => {
      const { invoke } = setup();
      dryRunCheckMock.mockResolvedValue({
        status: 'invalid',
        entityRef: 'component:default/order-api',
        reasons: [
          {
            code: 'unknown-fact',
            message: 'repoVisibility is not a known fact.',
          },
        ],
        collectedAt: {},
      });

      await expect(invoke('dry_run_check', input)).rejects.toMatchObject({
        name: 'InputError',
        message:
          'The check could not be evaluated: repoVisibility is not a known fact.',
      });
    });

    it('explains a check that does not apply to the entity', async () => {
      const { invoke } = setup();
      dryRunCheckMock.mockResolvedValue({
        status: 'not-applicable',
        entityRef: 'component:default/order-api',
        reasons: [{ code: 'no-facts', message: 'No facts collected yet.' }],
        collectedAt: {},
      });

      const { output } = await invoke('dry_run_check', input);

      expect(output).toMatchObject({
        status: 'not-applicable',
        passed: false,
        summary: expect.stringMatching(
          /does not apply .* No facts collected yet/,
        ),
      });
    });

    it('unwraps conditions repeated as {"conditions":{...}}', async () => {
      const { invoke } = setup();
      dryRunCheckMock.mockResolvedValue({
        status: 'passed',
        entityRef: 'x',
        reasons: [],
        collectedAt: {},
      });

      await invoke('dry_run_check', {
        ...input,
        check: {
          ...toolCheck,
          rule: { conditions: JSON.stringify({ conditions }) },
        },
      });

      expect(dryRunCheckMock).toHaveBeenCalledWith(
        expect.objectContaining({ check: draftCheck }),
      );
    });

    it.each([
      ['not JSON', '{all: [', /not valid JSON/],
      ['a JSON array', '[]', /top level is "all", "any" or "not"/],
      [
        'missing all/any/not',
        '{"fact":"x","operator":"equal","value":1}',
        /top level is/,
      ],
    ])('rejects conditions that are %s', async (_label, raw, message) => {
      const { invoke } = setup();

      await expect(
        invoke('dry_run_check', {
          ...input,
          check: { ...toolCheck, rule: { conditions: raw } },
        }),
      ).rejects.toThrow(message);
      expect(dryRunCheckMock).not.toHaveBeenCalled();
    });

    it('rejects an incomplete entity ref', async () => {
      const { invoke } = setup();

      await expect(
        invoke('dry_run_check', { ...input, entityRef: 'order-api' }),
      ).rejects.toThrow(/isn't a complete entity ref/);
    });
  });

  it('create_check saves a draft for a permitted user', async () => {
    const { invoke, registry } = setup();

    const { output } = await invoke('create_check', toolSave, user);

    expect(registry.register).toHaveBeenCalledWith({
      ...draftCheck,
      id: expect.any(String),
    });
    expect(output).toEqual({
      id: expect.any(String),
      name: 'Repo must be private',
      status: 'draft',
    });
  });

  it('create_check saves the category, tier and How to pass', async () => {
    const { invoke, registry } = setup();

    await invoke(
      'create_check',
      {
        ...toolCheck,
        metadata: {
          category: ' Security ',
          rank: 1,
          solution: 'Make the repository private.',
        },
      },
      user,
    );

    expect(registry.register).toHaveBeenCalledWith({
      ...draftCheck,
      metadata: {
        category: 'Security',
        rank: 1,
        solution: 'Make the repository private.',
      },
      id: expect.any(String),
    });
  });

  it('create_check applies to the kinds its fact retrievers collect for', async () => {
    const { invoke, registry, store } = setup();
    store.getLatestSchemas.mockResolvedValue([
      { id: 'a', entityFilter: [{ kind: ['Component', 'System'] }] },
      { id: 'b', entityFilter: { kind: 'component' } },
    ]);

    await invoke('create_check', toolSave, user);

    expect(registry.register).toHaveBeenCalledWith({
      ...draftCheck,
      filter: { kind: ['Component'] },
      id: expect.any(String),
    });
  });

  it('create_check refuses fact retrievers with no kind in common', async () => {
    const { invoke, registry, store } = setup();
    store.getLatestSchemas.mockResolvedValue([
      { id: 'a', entityFilter: [{ kind: 'component' }] },
      { id: 'b', entityFilter: [{ kind: 'ClusterComponentType' }] },
    ]);

    await expect(invoke('create_check', toolSave, user)).rejects.toThrow(
      "don't collect facts for any of the same entity kinds",
    );
    expect(registry.register).not.toHaveBeenCalled();
  });

  it.each([4, -1, 1.5])('refuses a tier of %s', async rank => {
    const { invoke, registry } = setup();

    await expect(
      invoke(
        'create_check',
        { ...toolSave, metadata: { ...keepMetadata, rank } },
        user,
      ),
    ).rejects.toThrow();
    expect(registry.register).not.toHaveBeenCalled();
  });

  describe('validate_check', () => {
    const input = { factIds: toolCheck.factIds, rule: toolCheck.rule };

    it('reports a valid rule', async () => {
      const { invoke, validator } = setup();

      const { output } = await invoke('validate_check', input);

      expect(output).toEqual({ valid: true, problems: [], kinds: [] });
      expect(validator.problemsOf).toHaveBeenCalledWith(
        expect.objectContaining({
          factIds: toolCheck.factIds,
          rule: { conditions },
        }),
      );
    });

    it('lists each problem with the condition it points at', async () => {
      const { invoke, validator } = setup();
      validator.problemsOf.mockResolvedValue([badOperator, unknownFact]);

      const { output } = await invoke('validate_check', input);

      expect(output).toEqual({
        valid: false,
        problems: [
          "The rule can't be evaluated: Unknown operator: equals (at /conditions/all/0/operator)",
          'No registered fact retriever provides a fact named repoVisibility.',
        ],
        kinds: [],
      });
    });

    it('returns the kinds the selected retrievers collect facts for', async () => {
      const { invoke, store } = setup();
      store.getLatestSchemas.mockResolvedValue([
        { id: 'a', entityFilter: [{ kind: 'component' }] },
        { id: 'b' },
      ]);

      const { output } = await invoke('validate_check', input);

      expect(output).toEqual({
        valid: true,
        problems: [],
        kinds: ['component'],
      });
    });

    it('reports retrievers with no kind in common', async () => {
      const { invoke, store } = setup();
      store.getLatestSchemas.mockResolvedValue([
        { id: 'a', entityFilter: [{ kind: 'component' }] },
        { id: 'b', entityFilter: [{ kind: 'ClusterComponentType' }] },
      ]);

      const { output } = await invoke('validate_check', input);

      expect(output).toEqual({
        valid: false,
        problems: [expect.stringContaining('any of the same entity kinds')],
        kinds: [],
      });
    });
  });

  describe('update_check', () => {
    const input = { ...toolSave, id: 'c1' };

    it('changes the rule and texts and keeps every other field', async () => {
      const { invoke, registry } = setup();

      const { output } = await invoke('update_check', input, user);

      expect(registry.update).toHaveBeenCalledWith('c1', {
        ...savedCheck,
        name: 'Repo must be private',
        description: '',
        factIds: toolCheck.factIds,
        rule: { conditions },
      });
      expect(output).toEqual({
        id: 'c1',
        name: 'Repo must be private',
        status: 'draft',
      });
    });

    it('sets the given metadata and keeps the rest', async () => {
      const { invoke, registry } = setup();

      await invoke(
        'update_check',
        {
          ...input,
          metadata: {
            category: '',
            rank: 3,
            solution: 'Make the repo private.',
          },
        },
        user,
      );

      expect(registry.update.mock.calls[0][1].metadata).toEqual({
        category: 'security',
        rank: 3,
        solution: 'Make the repo private.',
      });
      expect(registry.update.mock.calls[0][1].links).toEqual(savedCheck.links);
    });

    it('refuses a rule with problems, even for a draft', async () => {
      const { invoke, registry, validator } = setup();
      validator.problemsOf.mockResolvedValue([badOperator]);

      await expect(invoke('update_check', input, user)).rejects.toThrow(
        /can't be evaluated: .*\(at \/conditions\/all\/0\/operator\)/,
      );
      expect(registry.update).not.toHaveBeenCalled();
    });

    it('refuses fact retrievers with no kind in common', async () => {
      const { invoke, registry, store } = setup();
      store.getLatestSchemas.mockResolvedValue([
        { id: 'a', entityFilter: [{ kind: 'component' }] },
        { id: 'b', entityFilter: [{ kind: 'ClusterComponentType' }] },
      ]);

      await expect(invoke('update_check', input, user)).rejects.toThrow(
        "don't collect facts for any of the same entity kinds",
      );
      expect(registry.update).not.toHaveBeenCalled();
    });

    it('refuses fact retrievers that miss the kinds the check applies to', async () => {
      const { invoke, registry, store } = setup();
      registry.get.mockResolvedValue({
        ...savedCheck,
        filter: { kind: ['Component'] },
      } as typeof savedCheck);
      store.getLatestSchemas.mockResolvedValue([
        { id: 'a', entityFilter: [{ kind: 'ClusterComponentType' }] },
      ]);

      await expect(invoke('update_check', input, user)).rejects.toThrow(
        "don't collect facts for Component, the kinds this check applies to",
      );
      expect(registry.update).not.toHaveBeenCalled();
    });

    it('keeps the filter when the fact retrievers still collect for one of its kinds', async () => {
      const { invoke, registry, store } = setup();
      registry.get.mockResolvedValue({
        ...savedCheck,
        filter: { kind: ['Component', 'System'] },
      } as typeof savedCheck);
      store.getLatestSchemas.mockResolvedValue([
        { id: 'a', entityFilter: [{ kind: 'component' }] },
      ]);

      await invoke('update_check', input, user);

      expect(registry.update.mock.calls[0][1].filter).toEqual({
        kind: ['Component', 'System'],
      });
    });

    it('gives a hint for an unknown id', async () => {
      const { invoke, registry } = setup();

      await expect(
        invoke('update_check', { ...input, id: 'nope' }, user),
      ).rejects.toThrow(/No check with id "nope"; use list_checks/);
      expect(registry.update).not.toHaveBeenCalled();
    });
  });

  describe('publish_check', () => {
    it('publishes a valid check', async () => {
      const { invoke, registry, validator } = setup();

      const { output } = await invoke('publish_check', { id: 'c1' }, user);

      expect(validator.problemsOf).toHaveBeenCalledWith(savedCheck);
      expect(registry.publish).toHaveBeenCalledWith('c1');
      expect(output).toEqual({ id: 'c1', status: 'published' });
    });

    it('refuses a check with problems', async () => {
      const { invoke, registry, validator } = setup();
      validator.problemsOf.mockResolvedValue([unknownFact]);

      await expect(invoke('publish_check', { id: 'c1' }, user)).rejects.toThrow(
        /can't be evaluated: No registered fact retriever provides a fact named repoVisibility/,
      );
      expect(registry.publish).not.toHaveBeenCalled();
    });

    it('gives a hint for an unknown id', async () => {
      const { invoke, registry } = setup();

      await expect(
        invoke('publish_check', { id: 'nope' }, user),
      ).rejects.toThrow(/use list_checks/);
      expect(registry.publish).not.toHaveBeenCalled();
    });
  });

  describe('unpublish_check', () => {
    it('turns the check back into a draft', async () => {
      const { invoke, registry } = setup();

      const { output } = await invoke('unpublish_check', { id: 'c1' }, user);

      expect(registry.unpublish).toHaveBeenCalledWith('c1');
      expect(output).toEqual({ id: 'c1', status: 'draft' });
    });

    it('gives a hint for an unknown id', async () => {
      const { invoke, registry } = setup();

      await expect(
        invoke('unpublish_check', { id: 'nope' }, user),
      ).rejects.toThrow(/use list_checks/);
      expect(registry.unpublish).not.toHaveBeenCalled();
    });
  });
});
