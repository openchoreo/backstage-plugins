import type { Entity } from '@backstage/catalog-model';
import { mockServices } from '@backstage/backend-test-utils';
import type { FactRetrieverContext } from '@backstage-community/plugin-tech-insights-node';
import type { OpenChoreoTokenService } from '@openchoreo/openchoreo-auth';
import { createServiceClient } from './collectOpenChoreoFacts';
import { createOpenChoreoDeploymentFactRetriever } from './openchoreoDeploymentFactRetriever';

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
    'openchoreo.io/workload': `${name}-workload`,
  });

const ok = (data: unknown) => ({ data, response: { status: 200 } });
const status = (code: number) => ({
  data: undefined,
  response: { status: code },
});

function fakeClient(options: {
  capabilities?: unknown;
  profile?: () => unknown;
}) {
  const GET = jest.fn(async (path: string, { params }: any) => {
    switch (path) {
      case '/api/v1/authz/profile':
        return options.profile
          ? options.profile()
          : ok({ capabilities: options.capabilities ?? {} });
      case '/api/v1/namespaces/{namespaceName}/environments':
        return ok({
          items: [
            { metadata: { name: 'production' }, spec: { isProduction: true } },
          ],
        });
      case '/api/v1/namespaces/{namespaceName}/workloads/{workloadName}':
        return params.path.workloadName === 'gone-workload'
          ? status(404)
          : ok({ spec: { container: { image: 'ghcr.io/acme/api:1.2.0' } } });
      case '/api/v1/namespaces/{namespaceName}/components/{componentName}':
        return ok({ status: { latestRelease: { name: 'r2' } } });
      case '/api/v1/namespaces/{namespaceName}/releasebindings':
        return ok({
          items: [
            {
              spec: { environment: 'production', releaseName: 'r2' },
              status: { conditions: [{ type: 'Ready', status: 'True' }] },
            },
          ],
        });
      default:
        throw new Error(`Unexpected ${path}`);
    }
  });
  return { GET };
}

async function run(entities: Entity[], client: { GET: jest.Mock }) {
  mockGetEntities.mockResolvedValue({ items: entities });
  (createServiceClient as jest.Mock).mockResolvedValue(client);
  const retriever = createOpenChoreoDeploymentFactRetriever(
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

describe('openchoreoDeploymentFactRetriever', () => {
  const allBindings = {
    'releasebinding:view': { allowed: [{ path: '*' }], denied: [] },
  };

  it('reports binding facts when every binding can be read', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({ capabilities: allBindings }),
    );
    expect(byName.api).toEqual(
      expect.objectContaining({
        openchoreoComponentResolved: true,
        openchoreoDeployedToProduction: true,
        openchoreoReadyInAllEnvironments: true,
        openchoreoRunsLatestRelease: true,
      }),
    );
  });

  it('reports binding facts against a control plane with authorization off', async () => {
    const { byName } = await run(
      [annotated('api')],
      fakeClient({ capabilities: { '*': { allowed: [{ path: '*' }] } } }),
    );
    expect(byName.api).toHaveProperty('openchoreoDeployedToProduction', true);
  });

  it('leaves binding facts out for a project the grant does not cover', async () => {
    const { byName } = await run(
      [annotated('api'), annotated('ledger', 'billing')],
      fakeClient({
        capabilities: {
          'releasebinding:view': {
            allowed: [{ path: 'namespace/acme/project/payments' }],
          },
        },
      }),
    );
    expect(byName.api).toHaveProperty('openchoreoDeployedToProduction');
    expect(byName.ledger).not.toHaveProperty('openchoreoDeployedToProduction');
    expect(byName.ledger).toHaveProperty('openchoreoImagePinned', true);
  });

  it('reports every fact as null for a component it cannot find', async () => {
    const { byName } = await run(
      [annotated('gone'), component('unannotated', {})],
      fakeClient({ capabilities: allBindings }),
    );
    for (const facts of [byName.gone, byName.unannotated]) {
      expect(facts.openchoreoComponentResolved).toBe(false);
      expect(facts.openchoreoImagePinned).toBeNull();
      expect(facts.openchoreoDeployedToProduction).toBeNull();
    }
  });

  it('keeps Workload facts and retries the namespace after a failed load', async () => {
    let calls = 0;
    const client = fakeClient({
      profile: () => {
        calls += 1;
        return calls === 1 ? status(503) : ok({ capabilities: allBindings });
      },
    });
    const { byName, logger } = await run(
      [annotated('api'), annotated('web')],
      client,
    );
    expect(byName.api).toHaveProperty('openchoreoImagePinned', true);
    expect(byName.api).not.toHaveProperty('openchoreoDeployedToProduction');
    expect(byName.web).toHaveProperty('openchoreoDeployedToProduction', true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Reporting only Workload facts for api'),
    );
  });
});
