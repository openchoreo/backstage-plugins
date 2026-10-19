import { processingResult } from '@backstage/plugin-catalog-node';
import {
  RELATION_API_PROVIDED_BY,
  RELATION_OWNED_BY,
  RELATION_PART_OF,
  RELATION_PROVIDES_API,
} from '@backstage/catalog-model';
import {
  RELATION_HAS_INSTANCE,
  RELATION_INSTANCE_OF,
  RELATION_ROUTED_BY,
  RELATION_ROUTES_TO,
} from '@openchoreo/backstage-plugin-common';
import { EndpointEntityProcessor } from './EndpointEntityProcessor';

const location = { type: 'url', target: 'http://example.com' };

function endpointEntity(overrides: Record<string, unknown> = {}) {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Endpoint',
    metadata: {
      name: 'orders-api',
      namespace: 'acme',
      annotations: {
        'openchoreo.io/endpointtype': 'http-route',
        'openchoreo.io/endpointtype-kind': 'ClusterEndpointType',
      },
    },
    spec: {
      type: 'http-route',
      owner: 'group:default/openchoreo',
      system: 'store',
      visibility: ['external'],
      backends: [
        {
          name: 'primary',
          kind: 'Component',
          component: 'orders',
          endpoint: 'http',
        },
        {
          name: 'admin',
          kind: 'Component',
          component: 'orders',
          endpoint: 'admin',
        },
        {
          name: 'canary',
          kind: 'Component',
          component: 'orders-v2',
          endpoint: 'http',
        },
      ],
      ...overrides,
    },
  } as any;
}

const self = { kind: 'endpoint', namespace: 'acme', name: 'orders-api' };

function relationsOfType(emit: jest.Mock, type: string) {
  return emit.mock.calls
    .map(c => c[0])
    .filter(r => r.type === 'relation' && r.relation.type === type)
    .map(r => r.relation);
}

describe('EndpointEntityProcessor', () => {
  const processor = new EndpointEntityProcessor();

  it('validates only the Endpoint kind', async () => {
    expect(await processor.validateEntityKind(endpointEntity())).toBe(true);
    expect(
      await processor.validateEntityKind({ kind: 'Resource' } as any),
    ).toBe(false);
  });

  it('emits owner, project and type relations', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(endpointEntity(), location, emit);

    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: self,
        target: { kind: 'group', namespace: 'default', name: 'openchoreo' },
        type: RELATION_OWNED_BY,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: self,
        target: { kind: 'system', namespace: 'acme', name: 'store' },
        type: RELATION_PART_OF,
      }),
    );
    const typeRef = {
      kind: 'clusterendpointtype',
      namespace: 'openchoreo-cluster',
      name: 'http-route',
    };
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: self,
        target: typeRef,
        type: RELATION_INSTANCE_OF,
      }),
    );
    expect(emit).toHaveBeenCalledWith(
      processingResult.relation({
        source: typeRef,
        target: self,
        type: RELATION_HAS_INSTANCE,
      }),
    );
  });

  it('emits one routesTo/routedBy pair per backend component', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(endpointEntity(), location, emit);

    const targets = relationsOfType(emit, RELATION_ROUTES_TO).map(
      r => r.target.name,
    );
    expect(targets.sort()).toEqual(['orders', 'orders-v2']);
    expect(relationsOfType(emit, RELATION_ROUTED_BY)).toHaveLength(2);
  });

  it('emits providesApi only when the Endpoint has an API entity', async () => {
    const without = jest.fn();
    await processor.postProcessEntity(endpointEntity(), location, without);
    expect(relationsOfType(without, RELATION_PROVIDES_API)).toHaveLength(0);

    const withApi = jest.fn();
    await processor.postProcessEntity(
      endpointEntity({ providesApi: 'api:acme/endpoint-orders-api' }),
      location,
      withApi,
    );
    const apiRef = {
      kind: 'api',
      namespace: 'acme',
      name: 'endpoint-orders-api',
    };
    expect(withApi).toHaveBeenCalledWith(
      processingResult.relation({
        source: self,
        target: apiRef,
        type: RELATION_PROVIDES_API,
      }),
    );
    expect(withApi).toHaveBeenCalledWith(
      processingResult.relation({
        source: apiRef,
        target: self,
        type: RELATION_API_PROVIDED_BY,
      }),
    );
  });

  it('leaves other kinds alone', async () => {
    const emit = jest.fn();
    await processor.postProcessEntity(
      { kind: 'Component', metadata: { name: 'x' }, spec: {} } as any,
      location,
      emit,
    );
    expect(emit).not.toHaveBeenCalled();
  });
});
