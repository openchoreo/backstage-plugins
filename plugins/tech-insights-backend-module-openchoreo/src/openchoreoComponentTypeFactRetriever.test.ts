import type { Entity } from '@backstage/catalog-model';
import { mockServices } from '@backstage/backend-test-utils';
import type { FactRetrieverContext } from '@backstage-community/plugin-tech-insights-node';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import { createServiceClient } from './collectOpenChoreoFacts';
import { createOpenChoreoComponentTypeFactRetriever } from './openchoreoComponentTypeFactRetriever';

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

const CLUSTER_PATH = '/api/v1/clustercomponenttypes/{cctName}';
const NAMESPACED_PATH =
  '/api/v1/namespaces/{namespaceName}/componenttypes/{ctName}';

function componentType(
  kind: 'ClusterComponentType' | 'ComponentType',
  name: string,
  namespace?: string,
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind,
    metadata: namespace ? { name, namespace } : { name },
  };
}

const ok = (data: unknown) => ({ data, response: { status: 200 } });
const status = (code: number) => ({
  data: undefined,
  response: { status: code },
});

function fakeClient(responses: Record<string, unknown> = {}) {
  const GET = jest.fn(async (_path: string, { params }: any) => {
    const name = params.path.cctName ?? params.path.ctName;
    return (
      responses[name] ??
      ok({ spec: { workloadType: 'deployment', traits: [] } })
    );
  });
  return { GET };
}

async function run(entities: Entity[], client: { GET: jest.Mock }) {
  mockGetEntities.mockResolvedValue({ items: entities });
  (createServiceClient as jest.Mock).mockResolvedValue(client);
  const retriever = createOpenChoreoComponentTypeFactRetriever(
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

describe('openchoreoComponentTypeFactRetriever', () => {
  it('reads a ClusterComponentType from the cluster-scoped path', async () => {
    const client = fakeClient();
    const { byName } = await run(
      [componentType('ClusterComponentType', 'web-service')],
      client,
    );
    expect(client.GET).toHaveBeenCalledWith(CLUSTER_PATH, {
      params: { path: { cctName: 'web-service' } },
    });
    expect(byName['web-service']).toEqual(
      expect.objectContaining({
        openchoreoComponentTypeResolved: true,
        openchoreoWorkloadType: 'deployment',
      }),
    );
  });

  it('reads a ComponentType from its namespace, defaulting to "default"', async () => {
    const client = fakeClient();
    await run(
      [
        componentType('ComponentType', 'worker', 'acme'),
        componentType('ComponentType', 'cron'),
      ],
      client,
    );
    expect(client.GET).toHaveBeenCalledWith(NAMESPACED_PATH, {
      params: { path: { namespaceName: 'acme', ctName: 'worker' } },
    });
    expect(client.GET).toHaveBeenCalledWith(NAMESPACED_PATH, {
      params: { path: { namespaceName: 'default', ctName: 'cron' } },
    });
  });

  it('reports every fact as null for a component type it cannot find', async () => {
    const { byName } = await run(
      [componentType('ComponentType', 'gone', 'acme')],
      fakeClient({ gone: status(404) }),
    );
    const { openchoreoComponentTypeResolved, ...rest } = byName.gone;
    expect(openchoreoComponentTypeResolved).toBe(false);
    expect(Object.keys(rest)).not.toHaveLength(0);
    for (const value of Object.values(rest)) {
      expect(value).toBeNull();
    }
  });

  it('skips a component type it cannot read and keeps the others', async () => {
    const { byName, logger } = await run(
      [
        componentType('ClusterComponentType', 'broken'),
        componentType('ClusterComponentType', 'web-service'),
      ],
      fakeClient({ broken: status(500) }),
    );
    expect(byName).not.toHaveProperty('broken');
    expect(byName['web-service']).toHaveProperty(
      'openchoreoComponentTypeResolved',
      true,
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('HTTP 500'),
    );
  });
});
