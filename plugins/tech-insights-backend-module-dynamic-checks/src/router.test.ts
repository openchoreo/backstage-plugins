import express from 'express';
import request from 'supertest';
import { mockErrorHandler, mockServices } from '@backstage/backend-test-utils';
import { ConflictError } from '@backstage/errors';
import { AuthorizeResult } from '@backstage/plugin-permission-common';
import type { CatalogService } from '@backstage/plugin-catalog-node';
import type { DynamicCheckRegistry } from './DynamicCheckRegistry';
import type { CheckEvaluation } from './dryRun';
import type { CheckProblem } from './validation';
import { createDynamicChecksRouter } from './router';

function setup(options: {
  result: AuthorizeResult.ALLOW | AuthorizeResult.DENY;
  triggerTask?: jest.Mock;
  problems?: CheckProblem[];
  status?: 'draft' | 'published';
  checks?: unknown[];
}) {
  const registry = {
    listAll: jest.fn().mockResolvedValue(options.checks ?? []),
    register: jest.fn(),
    get: jest.fn().mockImplementation(async (id: string) => ({ id })),
    getStatus: jest.fn().mockResolvedValue(options.status ?? 'draft'),
    update: jest.fn().mockImplementation(async (_id, c) => c),
    delete: jest.fn(),
    publish: jest.fn().mockResolvedValue(undefined),
    unpublish: jest.fn(),
  } as unknown as DynamicCheckRegistry;
  const validator = {
    problemsOf: jest.fn().mockResolvedValue(options.problems ?? []),
    problemsOfEach: jest.fn(async (checks: unknown[]) =>
      checks.map(() => options.problems ?? []),
    ),
  };
  const scheduler = mockServices.scheduler.mock({
    triggerTask: options.triggerTask ?? jest.fn().mockResolvedValue(undefined),
  });
  const evaluation = {
    validator,
    checkerFor: jest.fn(),
    store: {
      getLatestSchemas: jest
        .fn()
        .mockImplementation(async (ids: string[]) =>
          ids.includes('githubRepositoryFactRetriever')
            ? [{ id: 'githubRepositoryFactRetriever' }]
            : [],
        ),
    },
  } as unknown as CheckEvaluation;

  return createDynamicChecksRouter({
    logger: mockServices.logger.mock(),
    registry,
    catalog: {} as CatalogService,
    httpAuth: mockServices.httpAuth(),
    permissions: mockServices.permissions({ result: options.result }),
    scheduler,
    getEvaluation: () => evaluation,
  }).then(router => ({
    app: express().use(router).use(mockErrorHandler()),
    registry,
    scheduler,
    validator,
  }));
}

describe('createDynamicChecksRouter permissions', () => {
  it('lists checks when allowed', async () => {
    const { app } = await setup({ result: AuthorizeResult.ALLOW });
    const response = await request(app).get('/dynamic-checks');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each([
    ['get', '/dynamic-checks'],
    ['post', '/dynamic-checks'],
    ['put', '/dynamic-checks/check-1'],
    ['delete', '/dynamic-checks/check-1'],
    ['post', '/dynamic-checks/check-1/publish'],
    ['post', '/dynamic-checks/check-1/unpublish'],
    ['post', '/dynamic-checks/dry-run'],
    [
      'post',
      '/dynamic-checks/fact-retrievers/githubRepositoryFactRetriever/trigger',
    ],
  ] as const)('denies %s %s without the permission', async (method, path) => {
    const { app, registry } = await setup({ result: AuthorizeResult.DENY });
    const response = await request(app)[method](path).send({});
    expect(response.status).toBe(403);
    expect(registry.publish).not.toHaveBeenCalled();
  });
});

describe('POST /dynamic-checks/fact-retrievers/:id/trigger', () => {
  it('starts a registered fact retriever', async () => {
    const { app, scheduler } = await setup({ result: AuthorizeResult.ALLOW });
    const response = await request(app).post(
      '/dynamic-checks/fact-retrievers/githubRepositoryFactRetriever/trigger',
    );
    expect(response.status).toBe(202);
    expect(scheduler.triggerTask).toHaveBeenCalledWith(
      'githubRepositoryFactRetriever',
    );
  });

  it('refuses a task that is not a fact retriever', async () => {
    const { app, scheduler } = await setup({ result: AuthorizeResult.ALLOW });
    const response = await request(app).post(
      '/dynamic-checks/fact-retrievers/some-other-task/trigger',
    );
    expect(response.status).toBe(404);
    expect(scheduler.triggerTask).not.toHaveBeenCalled();
  });

  it('reports a run already in progress as a conflict', async () => {
    const { app } = await setup({
      result: AuthorizeResult.ALLOW,
      triggerTask: jest
        .fn()
        .mockRejectedValue(new ConflictError('Task is currently running')),
    });
    const response = await request(app).post(
      '/dynamic-checks/fact-retrievers/githubRepositoryFactRetriever/trigger',
    );
    expect(response.status).toBe(409);
  });
});

describe('POST /dynamic-checks', () => {
  const check = {
    name: 'Default branch protected',
    factIds: ['githubRepositoryFactRetriever'],
    metadata: { rank: 1, category: 'Security', solution: 'Protect it.' },
    rule: {
      conditions: {
        all: [{ fact: 'branchProtected', operator: 'equal', value: true }],
      },
    },
  };

  it('stores links and success and failure metadata', async () => {
    const { app, registry } = await setup({ result: AuthorizeResult.ALLOW });
    (registry.register as jest.Mock).mockImplementation(async c => c);
    const body = {
      ...check,
      links: [{ title: 'Branch protection', url: 'https://docs.github.com/' }],
      successMetadata: { message: 'Protected.' },
      failureMetadata: { message: 'Not protected.' },
    };
    const response = await request(app).post('/dynamic-checks').send(body);
    expect(response.status).toBe(201);
    expect(registry.register).toHaveBeenCalledWith(
      expect.objectContaining({
        links: body.links,
        successMetadata: body.successMetadata,
        failureMetadata: body.failureMetadata,
      }),
    );
  });

  it.each([
    ['a link without a URL', { links: [{ title: 'Docs', url: '' }] }],
    ['links that are not an array', { links: { title: 'Docs' } }],
    ['failure metadata that is not an object', { failureMetadata: 'x' }],
    ['a rank in success metadata', { successMetadata: { rank: 3 } }],
    ['a category in failure metadata', { failureMetadata: { category: 'X' } }],
  ])('rejects %s', async (_label, extra) => {
    const { app, registry } = await setup({ result: AuthorizeResult.ALLOW });
    const response = await request(app)
      .post('/dynamic-checks')
      .send({ ...check, ...extra });
    expect(response.status).toBe(400);
    expect(registry.register).not.toHaveBeenCalled();
  });
});

describe('evaluability', () => {
  const check = {
    name: 'Default branch protected',
    factIds: ['githubRepositoryFactRetriever'],
    rule: {
      conditions: {
        all: [{ fact: 'githubNoSuchFact', operator: 'equal', value: true }],
      },
    },
  };
  const problem: CheckProblem = {
    code: 'unknown-fact',
    message:
      'No registered fact retriever provides a fact named githubNoSuchFact.',
  };

  it('refuses to publish a check that cannot be evaluated', async () => {
    const { app, registry } = await setup({
      result: AuthorizeResult.ALLOW,
      problems: [problem],
    });
    const response = await request(app).post('/dynamic-checks/check-1/publish');
    expect(response.status).toBe(400);
    expect(response.body.error.message).toContain(problem.message);
    expect(registry.publish).not.toHaveBeenCalled();
  });

  it('publishes a check that can be evaluated', async () => {
    const { app, registry } = await setup({ result: AuthorizeResult.ALLOW });
    const response = await request(app).post('/dynamic-checks/check-1/publish');
    expect(response.status).toBe(204);
    expect(registry.publish).toHaveBeenCalledWith('check-1');
  });

  it('refuses an edit to a published check that cannot be evaluated', async () => {
    const { app, registry } = await setup({
      result: AuthorizeResult.ALLOW,
      status: 'published',
      problems: [problem],
    });
    const response = await request(app)
      .put('/dynamic-checks/check-1')
      .send(check);
    expect(response.status).toBe(400);
    expect(registry.update).not.toHaveBeenCalled();
  });

  it('saves a draft that cannot be evaluated yet', async () => {
    const { app, registry, validator } = await setup({
      result: AuthorizeResult.ALLOW,
      status: 'draft',
      problems: [problem],
    });
    const response = await request(app)
      .put('/dynamic-checks/check-1')
      .send(check);
    expect(response.status).toBe(200);
    expect(registry.update).toHaveBeenCalled();
    expect(validator.problemsOf).not.toHaveBeenCalled();
  });

  it('lists the problems of each check', async () => {
    const { app } = await setup({
      result: AuthorizeResult.ALLOW,
      checks: [{ id: 'check-1', ...check, status: 'published' }],
      problems: [problem],
    });
    const response = await request(app).get('/dynamic-checks');
    expect(response.body).toEqual([
      expect.objectContaining({ id: 'check-1', problems: [problem] }),
    ]);
  });
});
