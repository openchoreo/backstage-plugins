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

// The check as a tool caller sends it.
const toolCheck = {
  name: 'Repo must be private',
  description: '',
  factIds: ['githubRepoMetadataFactRetriever'],
  rule: { conditions },
};

// create-check / update-check input: the check plus metadata, here with
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
    getEntitiesByRefs: jest.fn(async () => ({
      items: [{ kind: 'Component' }] as unknown[],
    })),
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
    const saves = { readOnly: false, destructive: false, idempotent: true };
    expect(attributes).toEqual({
      'list-checks': readOnly,
      'get-check': readOnly,
      'list-fact-schemas': readOnly,
      'get-entity-facts': readOnly,
      'dry-run-check': readOnly,
      'validate-check': readOnly,
      'create-check': saves,
      'update-check': saves,
      'publish-check': changesScores,
      'unpublish-check': changesScores,
    });
  });

  describe('permissions', () => {
    it('applies the read permission to a signed-in user', async () => {
      const { invoke, registry } = setup({ allow: false });

      await expect(invoke('list-checks', {}, user)).rejects.toThrow(
        /don't have the .* permission/,
      );
      expect(registry.listAll).not.toHaveBeenCalled();
    });

    it('authorizes a service caller too, like the REST routes', async () => {
      const { invoke, registry, permissions } = setup({ allow: false });

      await expect(invoke('list-checks', {}, agent)).rejects.toThrow(
        /don't have the .* permission/,
      );
      expect(permissions.authorize).toHaveBeenCalledWith(
        [{ permission: expect.objectContaining({ name: expect.any(String) }) }],
        { credentials: agent },
      );
      expect(registry.listAll).not.toHaveBeenCalled();
    });

    it('lets a permitted service caller read', async () => {
      const { invoke, registry } = setup();
      registry.listAll.mockResolvedValue([]);

      await expect(invoke('list-checks', {}, agent)).resolves.toEqual({
        output: { checks: [] },
      });
    });

    it('never lets a service caller save a check', async () => {
      const { invoke, registry } = setup();

      await expect(invoke('create-check', toolSave, agent)).rejects.toThrow(
        /requires a signed-in user/,
      );
      expect(registry.register).not.toHaveBeenCalled();
    });

    it('applies the manage permission to a user saving a check', async () => {
      const { invoke, registry } = setup({ allow: false });

      await expect(invoke('create-check', toolSave, user)).rejects.toThrow(
        /don't have the .* permission/,
      );
      expect(registry.register).not.toHaveBeenCalled();
    });

    it.each([
      ['update-check', { ...toolSave, id: 'c1' }],
      ['publish-check', { id: 'c1' }],
      ['unpublish-check', { id: 'c1' }],
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
      ['update-check', { ...toolSave, id: 'c1' }],
      ['publish-check', { id: 'c1' }],
      ['unpublish-check', { id: 'c1' }],
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

  it('get-check returns the full check, or a hint when the id is unknown', async () => {
    const { invoke, registry } = setup();
    registry.listAll.mockResolvedValue([
      { ...draftCheck, id: 'c1', description: undefined, status: 'published' },
    ]);

    const { output } = await invoke('get-check', { id: 'c1' });
    expect(output).toMatchObject({
      check: {
        id: 'c1',
        description: '',
        status: 'published',
        rule: { conditions },
      },
    });
    await expect(invoke('get-check', { id: 'nope' })).rejects.toThrow(
      /use list-checks/,
    );
  });

  it('list-fact-schemas treats an empty ids array as "all"', async () => {
    const { invoke, store } = setup();
    store.getLatestSchemas.mockResolvedValue([{ id: 'a' }]);

    await invoke('list-fact-schemas', { ids: [] });
    await invoke('list-fact-schemas', { ids: ['a'] });

    expect(store.getLatestSchemas.mock.calls).toEqual([[undefined], [['a']]]);
  });

  it('get-entity-facts normalises the entity ref and returns fact values', async () => {
    const { invoke, store } = setup();
    store.getLatestFactsByIds.mockResolvedValue({
      githubRepoMetadataFactRetriever: {
        id: 'row',
        timestamp: 'ts',
        facts: { githubVisibility: 'public' },
      },
    });

    const { output } = await invoke('get-entity-facts', {
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

  it('get-entity-facts reads no facts of an entity the caller cannot see', async () => {
    const { invoke, store, catalog } = setup();
    catalog.getEntitiesByRefs.mockResolvedValue({ items: [null] });

    await expect(
      invoke('get-entity-facts', {
        entityRef: 'component:default/Hidden-API',
        factIds: ['githubRepoMetadataFactRetriever'],
      }),
    ).rejects.toThrow("You don't have access to that entity.");

    // The same gate as the /facts routes.
    expect(catalog.getEntitiesByRefs).toHaveBeenCalledWith(
      { entityRefs: ['component:default/hidden-api'], fields: ['kind'] },
      { credentials: agent },
    );
    expect(store.getLatestFactsByIds).not.toHaveBeenCalled();
  });

  describe('dry-run-check', () => {
    const input = {
      entityRef: 'component:default/order-api',
      check: toolCheck,
    };

    it('returns the same result as the REST dry-run', async () => {
      const { invoke } = setup();
      const result = {
        status: 'failed' as const,
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
      };
      dryRunCheckMock.mockResolvedValue(result);

      const { output } = await invoke('dry-run-check', input);

      expect(output).toEqual(result);
      expect(dryRunCheckMock).toHaveBeenCalledWith(
        expect.objectContaining({
          check: draftCheck,
          entityRef: 'component:default/order-api',
        }),
      );
    });

    it('returns a check that cannot be evaluated as an invalid result', async () => {
      const { invoke } = setup();
      const result = {
        status: 'invalid' as const,
        entityRef: 'component:default/order-api',
        reasons: [
          {
            code: 'unknown-fact' as const,
            message: 'repoVisibility is not a known fact.',
          },
        ],
        collectedAt: {},
      };
      dryRunCheckMock.mockResolvedValue(result);

      const { output } = await invoke('dry-run-check', input);

      expect(output).toEqual(result);
    });

    it('rejects conditions with no all, any or not at the top', async () => {
      const { invoke } = setup();

      await expect(
        invoke('dry-run-check', {
          ...input,
          check: {
            ...toolCheck,
            rule: { conditions: { fact: 'x', operator: 'equal', value: 1 } },
          },
        }),
      ).rejects.toThrow(/top level is "all", "any" or "not"/);
      expect(dryRunCheckMock).not.toHaveBeenCalled();
    });

    it('rejects conditions sent as a JSON string', async () => {
      const { invoke } = setup();

      await expect(
        invoke('dry-run-check', {
          ...input,
          check: {
            ...toolCheck,
            rule: { conditions: JSON.stringify(conditions) },
          },
        }),
      ).rejects.toThrow();
      expect(dryRunCheckMock).not.toHaveBeenCalled();
    });

    it('rejects an incomplete entity ref', async () => {
      const { invoke } = setup();

      await expect(
        invoke('dry-run-check', { ...input, entityRef: 'order-api' }),
      ).rejects.toThrow(/isn't a complete entity ref/);
    });

    it('reports an entity the caller cannot see as not in the catalog', async () => {
      const { invoke, catalog } = setup();
      catalog.getEntityByRef.mockResolvedValue(undefined as any);

      await expect(invoke('dry-run-check', input)).rejects.toThrow(
        'No entity component:default/order-api in the catalog.',
      );
      expect(dryRunCheckMock).not.toHaveBeenCalled();
    });
  });

  it('create-check saves a draft for a permitted user', async () => {
    const { invoke, registry } = setup();

    const { output } = await invoke('create-check', toolSave, user);

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

  it('create-check saves the category, tier and How to pass', async () => {
    const { invoke, registry } = setup();

    await invoke(
      'create-check',
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

  it('create-check saves under the given id, so a repeat cannot save a second check', async () => {
    const { invoke, registry } = setup();
    const id = '0b5e8d6e-4a7c-4f8e-9a51-2f0d6f1c9b11';

    const { output } = await invoke('create-check', { ...toolSave, id }, user);

    expect(registry.register).toHaveBeenCalledWith({ ...draftCheck, id });
    expect(output).toMatchObject({ id });
  });

  it('create-check refuses an id that is not a UUID', async () => {
    const { invoke, registry } = setup();

    await expect(
      invoke('create-check', { ...toolSave, id: 'my-check' }, user),
    ).rejects.toThrow();
    expect(registry.register).not.toHaveBeenCalled();
  });

  it('create-check refuses a rule with problems', async () => {
    const { invoke, registry, validator } = setup();
    validator.problemsOf.mockResolvedValue([badOperator]);

    await expect(invoke('create-check', toolSave, user)).rejects.toThrow(
      /can't be evaluated: .*\(at \/conditions\/all\/0\/operator\)/,
    );
    expect(registry.register).not.toHaveBeenCalled();
  });

  it('create-check applies to the kinds its fact retrievers collect for', async () => {
    const { invoke, registry, store } = setup();
    store.getLatestSchemas.mockResolvedValue([
      { id: 'a', entityFilter: [{ kind: ['Component', 'System'] }] },
      { id: 'b', entityFilter: { kind: 'component' } },
    ]);

    await invoke('create-check', toolSave, user);

    expect(registry.register).toHaveBeenCalledWith({
      ...draftCheck,
      filter: { kind: ['Component'] },
      id: expect.any(String),
    });
  });

  it.each([4, -1, 1.5])('refuses a tier of %s', async rank => {
    const { invoke, registry } = setup();

    await expect(
      invoke(
        'create-check',
        { ...toolSave, metadata: { ...keepMetadata, rank } },
        user,
      ),
    ).rejects.toThrow();
    expect(registry.register).not.toHaveBeenCalled();
  });

  describe('validate-check', () => {
    const input = { factIds: toolCheck.factIds, rule: toolCheck.rule };

    it('reports a valid rule', async () => {
      const { invoke, validator } = setup();

      const { output } = await invoke('validate-check', input);

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

      const { output } = await invoke('validate-check', input);

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

      const { output } = await invoke('validate-check', input);

      expect(output).toEqual({
        valid: true,
        problems: [],
        kinds: ['component'],
      });
    });

    it("validates an edit with the saved check's entity filter", async () => {
      const { invoke, registry, validator } = setup();
      const filter = { kind: ['API'] };
      registry.get.mockResolvedValueOnce({
        ...savedCheck,
        filter,
      } as typeof savedCheck);

      await invoke('validate-check', { ...input, id: 'c1' });

      expect(registry.get).toHaveBeenCalledWith('c1');
      expect(validator.problemsOf).toHaveBeenCalledWith(
        expect.objectContaining({ filter }),
      );
    });

    it('validates a new rule without a filter', async () => {
      const { invoke, registry, validator } = setup();

      await invoke('validate-check', input);

      expect(registry.get).not.toHaveBeenCalled();
      expect(validator.problemsOf).toHaveBeenCalledWith(
        expect.not.objectContaining({ filter: expect.anything() }),
      );
    });

    it('gives a hint for an unknown id', async () => {
      const { invoke } = setup();

      await expect(
        invoke('validate-check', { ...input, id: 'nope' }),
      ).rejects.toThrow('No check with id "nope"; use list-checks.');
    });
  });

  describe('update-check', () => {
    const input = { ...toolSave, id: 'c1' };

    it('changes the rule and texts and keeps every other field', async () => {
      const { invoke, registry } = setup();

      const { output } = await invoke('update-check', input, user);

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
        'update-check',
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

      await expect(invoke('update-check', input, user)).rejects.toThrow(
        /can't be evaluated: .*\(at \/conditions\/all\/0\/operator\)/,
      );
      expect(registry.update).not.toHaveBeenCalled();
    });

    it('keeps the entity filter and validates the check with it', async () => {
      const { invoke, registry, validator } = setup();
      const filter = { kind: ['Component', 'System'] };
      registry.get.mockResolvedValue({
        ...savedCheck,
        filter,
      } as typeof savedCheck);

      await invoke('update-check', input, user);

      expect(validator.problemsOf).toHaveBeenCalledWith(
        expect.objectContaining({ filter }),
      );
      expect(registry.update.mock.calls[0][1].filter).toEqual(filter);
    });

    it('gives a hint for an unknown id', async () => {
      const { invoke, registry } = setup();

      await expect(
        invoke('update-check', { ...input, id: 'nope' }, user),
      ).rejects.toThrow(/No check with id "nope"; use list-checks/);
      expect(registry.update).not.toHaveBeenCalled();
    });
  });

  describe('publish-check', () => {
    it('publishes a valid check', async () => {
      const { invoke, registry, validator } = setup();

      const { output } = await invoke('publish-check', { id: 'c1' }, user);

      expect(validator.problemsOf).toHaveBeenCalledWith(savedCheck);
      expect(registry.publish).toHaveBeenCalledWith('c1');
      expect(output).toEqual({ id: 'c1', status: 'published' });
    });

    it('refuses a check with problems', async () => {
      const { invoke, registry, validator } = setup();
      validator.problemsOf.mockResolvedValue([unknownFact]);

      await expect(invoke('publish-check', { id: 'c1' }, user)).rejects.toThrow(
        /can't be evaluated: No registered fact retriever provides a fact named repoVisibility/,
      );
      expect(registry.publish).not.toHaveBeenCalled();
    });

    it('gives a hint for an unknown id', async () => {
      const { invoke, registry } = setup();

      await expect(
        invoke('publish-check', { id: 'nope' }, user),
      ).rejects.toThrow(/use list-checks/);
      expect(registry.publish).not.toHaveBeenCalled();
    });
  });

  describe('unpublish-check', () => {
    it('turns the check back into a draft', async () => {
      const { invoke, registry } = setup();

      const { output } = await invoke('unpublish-check', { id: 'c1' }, user);

      expect(registry.unpublish).toHaveBeenCalledWith('c1');
      expect(output).toEqual({ id: 'c1', status: 'draft' });
    });

    it('gives a hint for an unknown id', async () => {
      const { invoke, registry } = setup();

      await expect(
        invoke('unpublish-check', { id: 'nope' }, user),
      ).rejects.toThrow(/use list-checks/);
      expect(registry.unpublish).not.toHaveBeenCalled();
    });
  });
});
