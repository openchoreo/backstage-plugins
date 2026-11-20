import type { Entity } from '@backstage/catalog-model';
import { mockServices } from '@backstage/backend-test-utils';
import type { FactRetrieverContext } from '@backstage-community/plugin-tech-insights-node';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import { createServiceClient } from './collectOpenChoreoFacts';
import {
  createOpenChoreoBuildFactRetriever,
  MAX_RUN_PAGES,
} from './openchoreoBuildFactRetriever';

const mockGetEntities = jest.fn();
jest.mock('@backstage/catalog-client', () => ({
  CatalogClient: jest.fn().mockImplementation(() => ({
    getEntities: mockGetEntities,
  })),
}));
jest.mock('./collectOpenChoreoFacts', () => ({
  ...jest.requireActual('./collectOpenChoreoFacts'),
  createServiceClient: jest.fn(),
}));

const RUNS_PATH = '/api/v1/namespaces/{namespaceName}/workflowruns';

function component(name: string, annotations: Record<string, string>): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: { name, namespace: 'acme', annotations },
  };
}

const annotated = (name: string, project = 'payments') =>
  component(name, {
    'openchoreo.io/namespace': 'acme',
    'openchoreo.io/project': project,
    'openchoreo.io/component': name,
  });

const ok = (data: unknown) => ({ data, response: { status: 200 } });
const status = (code: number) => ({
  data: undefined,
  response: { status: code },
});

const succeeded = {
  metadata: { creationTimestamp: '2026-11-02T10:00:00Z' },
  status: {
    conditions: [
      { type: 'WorkflowCompleted', status: 'True' },
      { type: 'WorkflowSucceeded', status: 'True' },
    ],
  },
};
const failed = {
  metadata: { creationTimestamp: '2026-11-01T10:00:00Z' },
  status: {
    conditions: [
      { type: 'WorkflowCompleted', status: 'True' },
      { type: 'WorkflowFailed', status: 'True' },
    ],
  },
};

function fakeClient(runs?: (cursor?: string) => unknown) {
  const GET = jest.fn(async (path: string, { params }: any) => {
    if (path !== RUNS_PATH) {
      throw new Error(`Unexpected ${path}`);
    }
    return runs
      ? runs(params.query.cursor)
      : ok({ items: [succeeded, failed] });
  });
  return { GET };
}

async function run(entities: Entity[], client: { GET: jest.Mock }) {
  mockGetEntities.mockResolvedValue({ items: entities });
  (createServiceClient as jest.Mock).mockResolvedValue(client);
  const retriever = createOpenChoreoBuildFactRetriever(
    {} as OpenChoreoTokenService,
  );
  const logger = mockServices.logger.mock();
  const facts = await retriever.handler({
    config: mockServices.rootConfig(),
    discovery: mockServices.discovery(),
    auth: mockServices.auth(),
    logger,
    entityFilter: retriever.entityFilter,
  } as unknown as FactRetrieverContext);
  return {
    byName: Object.fromEntries(facts.map(f => [f.entity.name, f.facts])),
    logger,
  };
}

describe('openchoreoBuildFactRetriever', () => {
  it("reports the component's build facts", async () => {
    const { byName } = await run([annotated('api')], fakeClient());
    expect(byName.api).toEqual({
      openchoreoBuildLastSucceeded: true,
      openchoreoBuildSuccessRate: 0.5,
    });
  });

  it("lists the component's main-line runs, 100 at a time, under the entity's deadline", async () => {
    const client = fakeClient();
    await run([annotated('api')], client);
    expect(client.GET).toHaveBeenCalledWith(RUNS_PATH, {
      params: {
        path: { namespaceName: 'acme' },
        query: {
          labelSelector:
            'openchoreo.dev/project=payments,openchoreo.dev/component=api,!openchoreo.dev/release-line',
          limit: 100,
          cursor: undefined,
        },
      },
      signal: expect.any(AbortSignal),
    });
  });

  it("reports a release line's facts from its own runs", async () => {
    const line: Entity = {
      apiVersion: 'backstage.io/v1alpha1',
      kind: 'ReleaseLine',
      metadata: {
        name: 'experimental',
        namespace: 'acme',
        annotations: {
          'openchoreo.io/namespace': 'acme',
          'openchoreo.io/project': 'payments',
          'openchoreo.io/component': 'api',
          'openchoreo.io/release-line': 'experimental',
        },
      },
    };
    const client = fakeClient(() => ok({ items: [failed] }));
    const { byName } = await run([line], client);
    expect(byName.experimental).toEqual({
      openchoreoBuildLastSucceeded: false,
      openchoreoBuildSuccessRate: 0,
    });
    expect(client.GET.mock.calls[0][1].params.query.labelSelector).toBe(
      'openchoreo.dev/project=payments,openchoreo.dev/component=api,openchoreo.dev/release-line=experimental',
    );
  });

  it('reports nothing for a ReleaseLine that names no line', async () => {
    const client = fakeClient();
    const { byName } = await run(
      [
        {
          ...annotated('api'),
          kind: 'ReleaseLine',
          metadata: { ...annotated('api').metadata, name: 'orphan-line' },
        },
      ],
      client,
    );
    expect(byName).not.toHaveProperty('orphan-line');
    expect(client.GET).not.toHaveBeenCalled();
  });

  it('reports nothing for a component OpenChoreo does not manage', async () => {
    const client = fakeClient();
    const { byName } = await run([component('unmanaged', {})], client);
    expect(byName).not.toHaveProperty('unmanaged');
    expect(client.GET).not.toHaveBeenCalled();
  });

  it('reports no build facts without a namespace or project annotation', async () => {
    const client = fakeClient();
    const { byName } = await run(
      [component('orphan', { 'openchoreo.io/component': 'orphan' })],
      client,
    );
    expect(byName.orphan).toEqual({});
    expect(client.GET).not.toHaveBeenCalled();
  });

  it('reports no build facts when no finished build is retained', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient(() => ok({ items: [] })),
    );
    expect(byName.api).toEqual({});
  });

  it('follows the cursor across pages', async () => {
    const client = fakeClient(cursor =>
      cursor
        ? ok({ items: [failed] })
        : ok({ items: [succeeded], pagination: { nextCursor: 'next' } }),
    );
    const { byName } = await run([annotated('api')], client);
    expect(byName.api).toEqual({
      openchoreoBuildLastSucceeded: true,
      openchoreoBuildSuccessRate: 0.5,
    });
    expect(client.GET).toHaveBeenCalledTimes(2);
  });

  it('reports no build facts past the page cap', async () => {
    const client = fakeClient(() =>
      ok({ items: [succeeded], pagination: { nextCursor: 'more' } }),
    );
    const { byName, logger } = await run([annotated('api')], client);
    expect(byName.api).toEqual({});
    expect(client.GET).toHaveBeenCalledTimes(MAX_RUN_PAGES);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Leaving out build facts for api'),
    );
  });

  it('keeps the previous facts when the runs cannot be read', async () => {
    const { byName, logger } = await run(
      [annotated('api')],
      fakeClient(() => status(500)),
    );
    expect(byName).not.toHaveProperty('api');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GET workflow runs returned HTTP 500'),
    );
  });
});
