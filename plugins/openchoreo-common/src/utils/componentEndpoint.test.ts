import {
  buildComponentEndpoint,
  componentEndpointName,
  releaseLineEndpointInputs,
  toDnsLabel,
  type ComponentEndpointSummary,
} from './componentEndpoint';

describe('toDnsLabel', () => {
  it('keeps valid short names', () => {
    expect(toDnsLabel('orders-api')).toBe('orders-api');
  });

  it('replaces invalid characters', () => {
    expect(toDnsLabel('Orders_API.v1')).toBe('orders-api-v1');
  });

  it('shortens long names with a stable hash', () => {
    const long = `${'a'.repeat(50)}-${'b'.repeat(30)}`;
    const label = toDnsLabel(long);
    expect(label).toHaveLength(63);
    expect(label).toMatch(/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/);
    expect(label).toBe(toDnsLabel(long));
    expect(label).not.toBe(toDnsLabel(`${long}c`));
  });
});

describe('componentEndpointName', () => {
  it('names the Endpoint after the component and workload endpoint', () => {
    expect(componentEndpointName('orders', 'api')).toBe('orders-api');
  });

  it('appends the EndpointType when asked', () => {
    expect(componentEndpointName('orders', 'api', 'managed-http')).toBe(
      'orders-api-managed-http',
    );
  });

  it("names a release line's Endpoint apart from the main line's", () => {
    expect(componentEndpointName('orders', 'api', undefined, 'next')).toBe(
      'orders-next-api',
    );
    expect(componentEndpointName('orders', 'api', 'managed-http', 'next')).toBe(
      'orders-next-api-managed-http',
    );
  });

  it('keeps a long release line name a valid, distinct label', () => {
    const line = 'a-very-long-release-line-name-for-a-preview-branch';
    const name = componentEndpointName(
      'orders-service',
      'api',
      undefined,
      line,
    );
    expect(name).toHaveLength(63);
    expect(name).not.toBe(
      componentEndpointName('orders-service', 'api', undefined, `${line}2`),
    );
  });
});

describe('buildComponentEndpoint', () => {
  const input = {
    name: 'orders-api',
    componentName: 'orders',
    projectName: 'store',
    workloadEndpoint: 'api',
    typeKind: 'ClusterEndpointType' as const,
    typeName: 'http-route',
    visibility: ['external'],
    autoDeploy: true,
  };

  it('makes the component the owner and routes to its workload endpoint', () => {
    expect(buildComponentEndpoint(input)).toEqual({
      metadata: { name: 'orders-api' },
      spec: {
        owner: { projectName: 'store', componentName: 'orders' },
        type: { kind: 'ClusterEndpointType', name: 'http-route' },
        visibility: ['external'],
        backendRefs: [
          {
            name: 'orders-api',
            kind: 'Component',
            component: { name: 'orders', endpoint: 'api' },
          },
        ],
        autoDeploy: true,
      },
    });
  });

  it('makes the release line it was created for the owner and routes to it', () => {
    const endpoint = buildComponentEndpoint({
      ...input,
      name: 'orders-next-api',
      releaseLine: 'next',
    });
    expect(endpoint.spec.owner).toEqual({
      projectName: 'store',
      componentName: 'orders',
      releaseLineName: 'next',
    });
    expect(endpoint.spec.backendRefs).toEqual([
      {
        name: 'orders-next-api',
        kind: 'Component',
        component: { name: 'orders', endpoint: 'api', releaseLine: 'next' },
      },
    ]);
  });

  it('carries parameters only when there are any', () => {
    expect(
      buildComponentEndpoint({ ...input, parameters: {} }).spec,
    ).not.toHaveProperty('parameters');
    expect(
      buildComponentEndpoint({ ...input, parameters: { host: 'a' } }).spec
        .parameters,
    ).toEqual({ host: 'a' });
  });
});

describe('releaseLineEndpointInputs', () => {
  const summary = (
    over: Partial<ComponentEndpointSummary>,
  ): ComponentEndpointSummary => ({
    name: 'orders-api',
    workloadEndpoint: 'api',
    typeKind: 'ClusterEndpointType',
    typeName: 'unmanaged-http',
    visibility: ['external'],
    parameters: { pathPrefix: '/orders', cors: true },
    autoDeploy: false,
    ...over,
  });
  const target = {
    componentName: 'orders',
    projectName: 'store',
    releaseLine: 'next',
    autoDeploy: true,
  };

  it('copies each main Endpoint for the line', () => {
    expect(releaseLineEndpointInputs([summary({})], target)).toEqual([
      {
        name: 'orders-next-api',
        componentName: 'orders',
        projectName: 'store',
        releaseLine: 'next',
        workloadEndpoint: 'api',
        typeKind: 'ClusterEndpointType',
        typeName: 'unmanaged-http',
        visibility: ['external'],
        parameters: { pathPrefix: '/orders', cors: true },
        autoDeploy: true,
      },
    ]);
  });

  it('keeps the EndpointType suffix a main Endpoint was named with', () => {
    const inputs = releaseLineEndpointInputs(
      [
        summary({}),
        summary({
          name: 'orders-api-managed-http',
          typeName: 'managed-http',
        }),
      ],
      target,
    );
    expect(inputs.map(i => i.name)).toEqual([
      'orders-next-api',
      'orders-next-api-managed-http',
    ]);
  });

  it('skips Endpoints that already belong to a release line', () => {
    expect(
      releaseLineEndpointInputs(
        [summary({ name: 'orders-other-api', releaseLine: 'other' })],
        target,
      ),
    ).toEqual([]);
  });

  it('builds Endpoints that route to the line', () => {
    const [input] = releaseLineEndpointInputs([summary({})], target);
    const endpoint = buildComponentEndpoint(input);
    expect(endpoint.metadata.name).toBe('orders-next-api');
    expect(endpoint.spec.backendRefs[0].component).toEqual({
      name: 'orders',
      endpoint: 'api',
      releaseLine: 'next',
    });
  });

  it('does not share the parameters object with the main Endpoint', () => {
    const main = summary({});
    const [input] = releaseLineEndpointInputs([main], target);
    input.parameters!.pathPrefix = '/changed';
    expect(main.parameters.pathPrefix).toBe('/orders');
  });
});
