import {
  endpointApiEntityName,
  translateClusterEndpointTypeToEntity,
  translateEndpointToEntities,
  translateNewEndpointToEntities,
  translateNewEndpointTypeToEntity,
} from './entityTranslation';

const config = {
  locationKey: 'openchoreo-provider',
  defaultOwner: 'group:default/openchoreo',
};

const baseEndpoint = {
  name: 'orders-api',
  uid: 'ep-uid-1',
  projectName: 'store',
  typeName: 'http-route',
  typeKind: 'ClusterEndpointType' as const,
  visibility: ['internal', 'external'],
  backends: [
    {
      name: 'primary',
      kind: 'Component',
      component: 'orders',
      endpoint: 'http',
      weight: 90,
    },
    {
      name: 'canary',
      kind: 'Component',
      component: 'orders-v2',
      endpoint: 'http',
      weight: 10,
    },
  ],
  createdAt: '2026-10-19T10:00:00Z',
};

describe('translateEndpointToEntities', () => {
  it('emits only an Endpoint entity when no schema is declared', () => {
    const entities = translateEndpointToEntities(baseEndpoint, 'acme', config);

    expect(entities).toHaveLength(1);
    const [endpoint] = entities;
    expect(endpoint.kind).toBe('Endpoint');
    expect(endpoint.metadata.name).toBe('orders-api');
    expect(endpoint.metadata.namespace).toBe('acme');
    expect(endpoint.metadata.annotations).toMatchObject({
      'openchoreo.io/namespace': 'acme',
      'openchoreo.io/project': 'store',
      'openchoreo.io/endpoint': 'orders-api',
      'openchoreo.io/endpoint-uid': 'ep-uid-1',
      'openchoreo.io/endpointtype': 'http-route',
      'openchoreo.io/endpointtype-kind': 'ClusterEndpointType',
      'openchoreo.io/endpoint-visibility': 'internal,external',
    });
    expect(endpoint.metadata.labels).toMatchObject({
      'openchoreo.io/managed': 'true',
    });
    expect(endpoint.spec).toEqual({
      type: 'http-route',
      owner: 'group:default/openchoreo',
      system: 'store',
      visibility: ['internal', 'external'],
      backends: baseEndpoint.backends,
    });
  });

  it('emits an API entity for a declared schema and links it via providesApi', () => {
    const entities = translateEndpointToEntities(
      {
        ...baseEndpoint,
        schema: { type: 'openapi', content: 'openapi: 3.0.0' },
      },
      'acme',
      config,
    );

    expect(entities.map(e => e.kind)).toEqual(['Endpoint', 'API']);
    const [endpoint, api] = entities;
    expect(api.metadata.name).toBe(endpointApiEntityName('orders-api'));
    expect(api.metadata.namespace).toBe('acme');
    expect(api.metadata.annotations).toMatchObject({
      'openchoreo.io/project': 'store',
      'openchoreo.io/endpoint': 'orders-api',
    });
    expect(api.spec).toMatchObject({
      type: 'openapi',
      lifecycle: 'production',
      system: 'store',
      definition: 'openapi: 3.0.0',
    });
    expect(endpoint.spec?.providesApi).toBe('api:acme/endpoint-orders-api');
  });

  it('treats a schema without content as no schema', () => {
    const entities = translateEndpointToEntities(
      { ...baseEndpoint, schema: { type: 'openapi' } },
      'acme',
      config,
    );
    expect(entities).toHaveLength(1);
    expect(entities[0].spec?.providesApi).toBeUndefined();
  });
});

describe('translateNewEndpointToEntities', () => {
  it('maps the API shape, defaulting the type kind and backend kind', () => {
    const [endpoint] = translateNewEndpointToEntities(
      {
        metadata: {
          name: 'orders-api',
          namespace: 'acme',
          annotations: { 'openchoreo.dev/display-name': 'Orders API' },
        },
        spec: {
          owner: { projectName: 'store' },
          type: { name: 'http-route' },
          visibility: ['external'],
          backendRefs: [
            {
              name: 'primary',
              component: { name: 'orders', endpoint: 'http' },
            },
          ],
        },
      } as any,
      'acme',
      {
        providerName: 'openchoreo-provider',
        defaultOwner: 'group:default/openchoreo',
      } as any,
    );

    expect(endpoint.metadata.title).toBe('Orders API');
    expect(
      endpoint.metadata.annotations?.['openchoreo.io/endpointtype-kind'],
    ).toBe('EndpointType');
    expect(endpoint.spec?.backends).toEqual([
      {
        name: 'primary',
        kind: 'Component',
        component: 'orders',
        endpoint: 'http',
      },
    ]);
  });
});

describe('endpoint type translation', () => {
  it('lists the resource ids a namespaced type renders', () => {
    const entity = translateNewEndpointTypeToEntity(
      {
        metadata: { name: 'http-route', namespace: 'acme' },
        spec: { resources: [{ id: 'httproute', template: {} }] },
      } as any,
      'acme',
      { providerName: 'openchoreo-provider' } as any,
    );
    expect(entity.kind).toBe('EndpointType');
    expect(entity.spec).toEqual({
      domain: 'default/acme',
      resources: ['httproute'],
    });
  });

  it('places cluster types in the openchoreo-cluster namespace', () => {
    const entity = translateClusterEndpointTypeToEntity(
      { name: 'http-route' },
      { locationKey: 'openchoreo-provider' },
    );
    expect(entity.kind).toBe('ClusterEndpointType');
    expect(entity.metadata.namespace).toBe('openchoreo-cluster');
    expect(entity.spec).toEqual({});
  });
});
