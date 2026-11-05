import {
  parseImage,
  releaseBindingFacts,
  workloadFacts,
} from './deploymentFacts';

describe('parseImage', () => {
  it.each([
    ['cr.openchoreo.dev/samples/greeter:latest', 'cr.openchoreo.dev', false],
    ['cr.openchoreo.dev/samples/greeter', 'cr.openchoreo.dev', false],
    ['cr.openchoreo.dev/samples/greeter:v1.2.0', 'cr.openchoreo.dev', true],
    ['nginx:1.27', 'docker.io', true],
    ['library/nginx', 'docker.io', false],
    ['localhost:5000/app', 'localhost:5000', false],
    ['localhost:5000/app:dev', 'localhost:5000', true],
    ['ghcr.io/org/app@sha256:abc', 'ghcr.io', true],
  ])('%s', (image, registry, pinned) => {
    expect(parseImage(image)).toEqual({ registry, pinned });
  });
});

describe('workloadFacts', () => {
  it('counts external endpoints and secret-like plain values', () => {
    expect(
      workloadFacts({
        container: {
          image: 'cr.openchoreo.dev/samples/greeter:latest',
          env: [
            { key: 'LOG_LEVEL', value: 'debug' },
            { key: 'GITHUB_TOKEN', valueFrom: { secretKeyRef: {} } },
            { key: 'DB_PASSWORD', value: 'hunter2' },
            { key: 'STRIPE_API_KEY', value: 'sk_live' },
          ],
        },
        endpoints: {
          http: { visibility: ['external'] },
          admin: { visibility: ['internal'] },
          grpc: {},
        },
      }),
    ).toEqual({
      openchoreoComponentResolved: true,
      openchoreoImageRegistry: 'cr.openchoreo.dev',
      openchoreoImagePinned: false,
      openchoreoExternalEndpointCount: 1,
      openchoreoPlainTextSecretEnvCount: 2,
    });
  });
});

describe('releaseBindingFacts', () => {
  const ready = { conditions: [{ type: 'Ready', status: 'True' }] };
  const notReady = { conditions: [{ type: 'Ready', status: 'False' }] };

  it('reports a component deployed to development only', () => {
    expect(
      releaseBindingFacts({
        bindings: [
          {
            spec: { environment: 'development', releaseName: 'r2' },
            status: ready,
          },
        ],
        productionEnvironments: new Set(['production']),
        latestRelease: 'r2',
      }),
    ).toEqual({
      openchoreoDeployedEnvironments: ['development'],
      openchoreoDeployedToProduction: false,
      openchoreoReadyInAllEnvironments: true,
      openchoreoRunsLatestRelease: true,
    });
  });

  it('ignores undeployed bindings and flags stale or unready environments', () => {
    expect(
      releaseBindingFacts({
        bindings: [
          {
            spec: { environment: 'development', releaseName: 'r2' },
            status: ready,
          },
          {
            spec: { environment: 'production', releaseName: 'r1' },
            status: notReady,
          },
          {
            spec: {
              environment: 'staging',
              releaseName: 'r2',
              state: 'Undeploy',
            },
            status: ready,
          },
        ],
        productionEnvironments: new Set(['production']),
        latestRelease: 'r2',
      }),
    ).toEqual({
      openchoreoDeployedEnvironments: ['development', 'production'],
      openchoreoDeployedToProduction: true,
      openchoreoReadyInAllEnvironments: false,
      openchoreoRunsLatestRelease: false,
    });
  });

  it('reports a component with no bindings as not ready and not current', () => {
    expect(
      releaseBindingFacts({
        bindings: [],
        productionEnvironments: new Set(),
        latestRelease: 'r1',
      }),
    ).toEqual({
      openchoreoDeployedEnvironments: [],
      openchoreoDeployedToProduction: false,
      openchoreoReadyInAllEnvironments: false,
      openchoreoRunsLatestRelease: false,
    });
  });
});
