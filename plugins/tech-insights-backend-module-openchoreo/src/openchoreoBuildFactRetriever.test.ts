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

const PROFILE_PATH = '/api/v1/authz/profile';
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

const allRuns = {
  'workflowrun:view': { allowed: [{ path: '*' }], denied: [] },
};

function fakeClient(options: {
  capabilities?: unknown;
  profile?: () => unknown;
  runs?: (cursor?: string) => unknown;
}) {
  const GET = jest.fn(async (path: string, { params }: any) => {
    switch (path) {
      case PROFILE_PATH:
        return options.profile
          ? options.profile()
          : ok({ capabilities: options.capabilities ?? {} });
      case RUNS_PATH:
        return options.runs
          ? options.runs(params.query.cursor)
          : ok({ items: [succeeded, failed] });
      default:
        throw new Error(`Unexpected ${path}`);
    }
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

const runsCalls = (client: { GET: jest.Mock }) =>
  client.GET.mock.calls.filter(([path]) => path === RUNS_PATH);

describe('openchoreoBuildFactRetriever', () => {
  it('reports build facts when every run can be read', async () => {
    const client = fakeClient({ capabilities: allRuns });
    const { byName } = await run([annotated('api')], client);
    expect(byName.api).toEqual({
      openchoreoBuildLastSucceeded: true,
      openchoreoBuildSuccessRate: 0.5,
    });
  });

  it("lists the component's runs on every release line, 100 at a time", async () => {
    const client = fakeClient({ capabilities: allRuns });
    await run([annotated('api')], client);
    expect(client.GET).toHaveBeenCalledWith(RUNS_PATH, {
      params: {
        path: { namespaceName: 'acme' },
        query: {
          labelSelector:
            'openchoreo.dev/project=payments,openchoreo.dev/component=api',
          limit: 100,
          cursor: undefined,
        },
      },
      signal: expect.any(AbortSignal),
    });
  });

  it("sends every request under the entity's deadline", async () => {
    const client = fakeClient({ capabilities: allRuns });
    await run([annotated('api')], client);
    expect(client.GET).toHaveBeenCalled();
    for (const [, options] of client.GET.mock.calls) {
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('reads the authz profile once per namespace', async () => {
    const client = fakeClient({ capabilities: allRuns });
    await run([annotated('api'), annotated('web')], client);
    expect(
      client.GET.mock.calls.filter(([path]) => path === PROFILE_PATH),
    ).toHaveLength(1);
  });

  it('reports build facts against a control plane with authorization off', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({ capabilities: { '*': { allowed: [{ path: '*' }] } } }),
    );
    expect(byName.api).toHaveProperty('openchoreoBuildLastSucceeded', true);
  });

  it.each([
    ['no workflowrun grant', {}],
    [
      'a grant on another project',
      {
        'workflowrun:view': { allowed: [{ path: 'ns/acme/project/billing' }] },
      },
    ],
    [
      'a grant limited by a CEL condition',
      {
        'workflowrun:view': {
          allowed: [
            {
              path: '*',
              constraints: { expressions: ['resource.releaseLine == ""'] },
            },
          ],
        },
      },
    ],
    [
      'a denial on the project',
      {
        'workflowrun:view': {
          allowed: [{ path: '*' }],
          denied: [{ path: 'ns/acme/project/payments' }],
        },
      },
    ],
  ])('reports no build facts with %s', async (_label, capabilities) => {
    const client = fakeClient({ capabilities });
    const { byName } = await run([annotated('api')], client);
    expect(byName.api).toEqual({});
    expect(runsCalls(client)).toHaveLength(0);
  });

  it('reports nothing for a component OpenChoreo does not manage', async () => {
    const { byName } = await run(
      [component('unmanaged', {})],
      fakeClient({ capabilities: allRuns }),
    );
    expect(byName).not.toHaveProperty('unmanaged');
  });

  it('reports no build facts when no finished build is retained', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({ capabilities: allRuns, runs: () => ok({ items: [] }) }),
    );
    expect(byName.api).toEqual({});
  });

  it('follows the cursor across pages', async () => {
    const client = fakeClient({
      capabilities: allRuns,
      runs: cursor =>
        cursor
          ? ok({ items: [failed] })
          : ok({ items: [succeeded], pagination: { nextCursor: 'next' } }),
    });
    const { byName } = await run([annotated('api')], client);
    expect(byName.api).toEqual({
      openchoreoBuildLastSucceeded: true,
      openchoreoBuildSuccessRate: 0.5,
    });
    expect(runsCalls(client)).toHaveLength(2);
  });

  it('reports no build facts past the page cap', async () => {
    const client = fakeClient({
      capabilities: allRuns,
      runs: () =>
        ok({ items: [succeeded], pagination: { nextCursor: 'more' } }),
    });
    const { byName, logger } = await run([annotated('api')], client);
    expect(byName.api).toEqual({});
    expect(runsCalls(client)).toHaveLength(MAX_RUN_PAGES);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Leaving out build facts for api'),
    );
  });

  it('keeps the previous facts when the runs or the profile cannot be read', async () => {
    let profileCalls = 0;
    const client = fakeClient({
      profile: () => {
        profileCalls += 1;
        return profileCalls === 1 ? status(503) : ok({ capabilities: allRuns });
      },
      runs: () => status(500),
    });
    const { byName, logger } = await run(
      [annotated('api'), annotated('web')],
      client,
    );
    expect(byName).not.toHaveProperty('api');
    expect(byName).not.toHaveProperty('web');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('authz profile'),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('GET workflow runs returned HTTP 500'),
    );
  });
});
