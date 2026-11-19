import { applyComponentEndpointUrls } from './componentEndpointUrls';
import type { Environment } from '../../types';

const env = (
  name: string,
  endpoints: Environment['endpoints'],
): Environment => ({
  name,
  resourceName: name,
  deployment: {},
  endpoints,
});

// What a ReleaseBinding reports for a component of an older ComponentType.
const releaseBindingEntry = {
  name: 'http',
  type: 'HTTP',
  externalURLs: {
    https: { scheme: 'https', host: 'greeter.example.com', port: 443 },
  },
  serviceURL: { scheme: 'http', host: 'greeter.dp-ns.svc', port: 8080 },
};

const endpoint = (name: string, workloadEndpoints: string[]) =>
  ({
    metadata: { name },
    spec: {
      backendRefs: workloadEndpoints.map(ep => ({
        name: ep,
        component: { name: 'greeter', endpoint: ep },
      })),
    },
  } as any);

const binding = (environment: string, urls: Record<string, unknown>) =>
  ({ spec: { environment }, status: { urls } } as any);

describe('applyComponentEndpointUrls', () => {
  it('leaves environments untouched when the component has no Endpoints', () => {
    const environments = [env('development', [releaseBindingEntry])];
    expect(applyComponentEndpointUrls(environments, [])).toBe(environments);
  });

  it("takes a workload endpoint's URLs from its Endpoint where it is deployed", () => {
    const [dev] = applyComponentEndpointUrls(
      [env('development', [releaseBindingEntry])],
      [
        {
          endpoint: endpoint('greeter-http', ['http']),
          bindings: [
            binding('development', {
              external: {
                scheme: 'https',
                host: 'greeter-http.api.example.com',
                port: 8443,
                path: '/greeter',
                security: {
                  scheme: 'apiKey',
                  apiKey: { in: 'header', name: 'api-key' },
                },
              },
              namespace: { scheme: 'http', host: 'greeter-http.ns.local' },
            }),
          ],
        },
      ],
    );

    expect(dev.endpoints).toEqual([
      {
        name: 'http',
        type: 'HTTP',
        externalURLs: {
          https: {
            scheme: 'https',
            host: 'greeter-http.api.example.com',
            port: 8443,
            path: '/greeter',
            security: {
              scheme: 'apiKey',
              apiKey: { in: 'header', name: 'api-key' },
            },
          },
        },
        namespaceURLs: {
          http: { scheme: 'http', host: 'greeter-http.ns.local', port: 0 },
        },
        // No project URL declared, so the in-cluster service URL stays.
        serviceURL: releaseBindingEntry.serviceURL,
        endpointName: 'greeter-http',
      },
    ]);
  });

  it('keeps the ReleaseBinding URLs in environments the Endpoint is not deployed to', () => {
    const [, staging] = applyComponentEndpointUrls(
      [
        env('development', [releaseBindingEntry]),
        env('staging', [releaseBindingEntry]),
      ],
      [
        {
          endpoint: endpoint('greeter-http', ['http']),
          bindings: [
            binding('development', {
              external: { scheme: 'https', host: 'dev.example.com' },
            }),
          ],
        },
      ],
    );
    expect(staging.endpoints).toEqual([releaseBindingEntry]);
  });

  it('keeps workload endpoints without an Endpoint as the ReleaseBinding reports them', () => {
    const admin = {
      name: 'admin',
      serviceURL: { scheme: 'http', host: 'greeter.dp-ns.svc', port: 9090 },
    };
    const [dev] = applyComponentEndpointUrls(
      [env('development', [releaseBindingEntry, admin])],
      [
        {
          endpoint: endpoint('greeter-http', ['http']),
          bindings: [
            binding('development', {
              internal: { scheme: 'http', host: 'greeter.internal' },
            }),
          ],
        },
      ],
    );
    expect(dev.endpoints.find(e => e.name === 'admin')).toEqual(admin);
    expect(dev.endpoints.find(e => e.name === 'http')).toMatchObject({
      internalURLs: { http: { host: 'greeter.internal' } },
    });
    expect(
      dev.endpoints.find(e => e.name === 'http')?.externalURLs,
    ).toBeUndefined();
  });

  it("prefers the Endpoint's project URL over the service URL", () => {
    const [dev] = applyComponentEndpointUrls(
      [env('development', [releaseBindingEntry])],
      [
        {
          endpoint: endpoint('greeter-http', ['http']),
          bindings: [
            binding('development', {
              project: { scheme: 'http', host: 'greeter.project', path: '/v1' },
            }),
          ],
        },
      ],
    );
    expect(dev.endpoints[0].projectURL).toEqual({
      scheme: 'http',
      host: 'greeter.project',
      port: 0,
      path: '/v1',
    });
  });

  it('adds an entry for an exposed workload endpoint the ReleaseBinding has not reported yet', () => {
    const [dev] = applyComponentEndpointUrls(
      [env('development', [])],
      [
        {
          endpoint: endpoint('greeter-grpc', ['grpc']),
          bindings: [
            binding('development', {
              external: {
                scheme: 'grpcs',
                host: 'grpc.example.com',
                port: 443,
              },
            }),
          ],
        },
      ],
    );
    expect(dev.endpoints).toEqual([
      {
        name: 'grpc',
        externalURLs: {
          grpcs: { scheme: 'grpcs', host: 'grpc.example.com', port: 443 },
        },
        endpointName: 'greeter-grpc',
      },
    ]);
  });

  it('matches environments case-insensitively', () => {
    const [dev] = applyComponentEndpointUrls(
      [env('Development', [releaseBindingEntry])],
      [
        {
          endpoint: endpoint('greeter-http', ['http']),
          bindings: [
            binding('development', {
              external: { scheme: 'https', host: 'dev.example.com' },
            }),
          ],
        },
      ],
    );
    expect(dev.endpoints[0].endpointName).toBe('greeter-http');
  });

  it("prefers an Endpoint's project URL over the in-cluster service URL", () => {
    const [dev] = applyComponentEndpointUrls(
      [env('development', [releaseBindingEntry])],
      [
        {
          endpoint: endpoint('greeter-http', ['http']),
          bindings: [
            binding('development', {
              project: {
                scheme: 'http',
                host: 'greeter-http.project.local',
                port: 80,
                path: '/greeter',
              },
            }),
          ],
        },
      ],
    );

    expect(dev.endpoints[0]).toMatchObject({
      projectURL: {
        scheme: 'http',
        host: 'greeter-http.project.local',
        port: 80,
        path: '/greeter',
      },
      serviceURL: releaseBindingEntry.serviceURL,
      endpointName: 'greeter-http',
    });
    // The Endpoint resolved no external URL, so the ReleaseBinding's is gone.
    expect(dev.endpoints[0].externalURLs).toBeUndefined();
  });
});
