import {
  NO_ENDPOINT,
  defaultEndpointType,
  endpointProtocol,
  endpointTypeCandidates,
  endpointTypeOptions,
  endpointTypeProtocols,
  isLegacyEndpointsComponentType,
  protocolForEndpointType,
  resolveEndpointType,
  workloadEndpointsForSave,
  type AllowedEndpointTypeEntry,
} from './endpointExposure';

const route: AllowedEndpointTypeEntry = {
  protocols: ['HTTP', 'GraphQL'],
  ref: { kind: 'ClusterEndpointType', name: 'http-route' },
  default: true,
};
const managed: AllowedEndpointTypeEntry = {
  name: 'managed',
  protocols: ['HTTP'],
  ref: { kind: 'ClusterEndpointType', name: 'managed-http' },
};
const grpc: AllowedEndpointTypeEntry = {
  protocols: ['gRPC'],
  ref: { kind: 'ClusterEndpointType', name: 'grpc-route' },
};
const entries = [managed, route, grpc];

describe('endpointProtocol', () => {
  it('prefers protocol and falls back to the deprecated type', () => {
    expect(endpointProtocol({ protocol: 'gRPC', type: 'HTTP' })).toBe('gRPC');
    expect(endpointProtocol({ type: 'HTTP' })).toBe('HTTP');
    expect(endpointProtocol({})).toBe('');
  });
});

describe('isLegacyEndpointsComponentType', () => {
  it('is true only for the annotation set to "true"', () => {
    expect(
      isLegacyEndpointsComponentType({
        'openchoreo.dev/legacy-endpoints': 'true',
      }),
    ).toBe(true);
    expect(
      isLegacyEndpointsComponentType({
        'openchoreo.dev/legacy-endpoints': 'false',
      }),
    ).toBe(false);
    expect(isLegacyEndpointsComponentType({})).toBe(false);
    expect(isLegacyEndpointsComponentType(undefined)).toBe(false);
  });
});

describe('endpointTypeCandidates', () => {
  it('lists entries for the protocol, default first', () => {
    expect(
      endpointTypeCandidates('HTTP', entries).map(e => e.ref.name),
    ).toEqual(['http-route', 'managed-http']);
    expect(endpointTypeCandidates('TCP', entries)).toEqual([]);
  });
});

describe('defaultEndpointType', () => {
  it('returns the default entry, else the first allowed one, else none', () => {
    expect(defaultEndpointType('HTTP', entries)).toBe(
      'ClusterEndpointType/http-route',
    );
    expect(defaultEndpointType('gRPC', entries)).toBe(
      'ClusterEndpointType/grpc-route',
    );
    expect(defaultEndpointType('TCP', entries)).toBe(NO_ENDPOINT);
  });
});

describe('resolveEndpointType', () => {
  const http = { protocol: 'HTTP', visibility: ['external'] };

  it('keeps a valid choice', () => {
    expect(
      resolveEndpointType(http, entries, {
        type: 'ClusterEndpointType/managed-http',
      }),
    ).toBe('ClusterEndpointType/managed-http');
  });

  it('ignores a "none" choice and uses the default', () => {
    expect(resolveEndpointType(http, entries, { type: NO_ENDPOINT })).toBe(
      'ClusterEndpointType/http-route',
    );
  });

  it('falls back to the default when the choice no longer fits', () => {
    expect(
      resolveEndpointType(http, entries, {
        type: 'ClusterEndpointType/grpc-route',
      }),
    ).toBe('ClusterEndpointType/http-route');
  });
});

describe('workloadEndpointsForSave', () => {
  it('drops visibility the Endpoint carries and sets protocol', () => {
    expect(
      workloadEndpointsForSave(
        {
          api: { type: 'HTTP', port: 80, visibility: ['project', 'external'] },
          legacy: { type: 'HTTP', port: 81, visibility: ['external'] },
        },
        ['api'],
      ),
    ).toEqual({
      api: {
        type: 'HTTP',
        protocol: 'HTTP',
        port: 80,
        visibility: ['project'],
      },
      legacy: {
        type: 'HTTP',
        protocol: 'HTTP',
        port: 81,
        visibility: ['external'],
      },
    });
  });
});

describe('endpointTypeOptions', () => {
  it('lists each type once, default first, with every protocol it serves', () => {
    const grpcToo: AllowedEndpointTypeEntry = {
      protocols: ['gRPC'],
      ref: route.ref,
    };
    const options = endpointTypeOptions([managed, grpcToo, route, grpc]);

    expect(options.map(o => o.key)).toEqual([
      'ClusterEndpointType/http-route',
      'ClusterEndpointType/managed-http',
      'ClusterEndpointType/grpc-route',
    ]);
    // Shown as the default entry, serving the protocols of both entries.
    expect(options[0].entry).toBe(route);
    expect(options[0].protocols).toEqual(['HTTP', 'GraphQL', 'gRPC']);
  });
});

describe('endpointTypeProtocols', () => {
  it("returns a type's protocols, and none for a type that isn't allowed", () => {
    expect(
      endpointTypeProtocols('ClusterEndpointType/http-route', entries),
    ).toEqual(['HTTP', 'GraphQL']);
    expect(endpointTypeProtocols('EndpointType/gone', entries)).toEqual([]);
  });
});

describe('protocolForEndpointType', () => {
  it('keeps a protocol the type serves', () => {
    expect(
      protocolForEndpointType(
        'GraphQL',
        'ClusterEndpointType/http-route',
        entries,
      ),
    ).toBe('GraphQL');
  });

  it("prefers HTTP when the type doesn't serve the protocol", () => {
    expect(
      protocolForEndpointType('TCP', 'ClusterEndpointType/http-route', entries),
    ).toBe('HTTP');
  });

  it("falls back to the type's first protocol", () => {
    expect(
      protocolForEndpointType('HTTP', 'ClusterEndpointType/grpc-route', entries),
    ).toBe('gRPC');
  });

  it("keeps the protocol for a type that isn't allowed", () => {
    expect(protocolForEndpointType('TCP', 'EndpointType/gone', entries)).toBe(
      'TCP',
    );
  });
});
