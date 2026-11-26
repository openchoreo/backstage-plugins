import {
  activeBindings,
  endpointsPerEnvironment,
  environmentDeployment,
  everyReleaseRead,
  isSecretLikeKey,
  lineBindings,
  lineExternalEndpoints,
  parseImage,
  plainTextSecretEnvCount,
  type Endpoint,
  type ReleaseBinding,
  type ReleasedWorkload,
} from './deploymentFacts';

describe('parseImage', () => {
  it.each([
    ['cr.openchoreo.dev/samples/greeter:latest', 'cr.openchoreo.dev', false],
    ['cr.openchoreo.dev/samples/greeter', 'cr.openchoreo.dev', false],
    ['cr.openchoreo.dev/samples/greeter:v1.2.0', 'cr.openchoreo.dev', true],
    ['nginx:1.27', 'docker.io', true],
    ['library/nginx', 'docker.io', false],
    ['localhost:5000/app', 'localhost:5000', false],
    ['localhost:5000/app:dev', 'localhost:5000', false],
    ['ghcr.io/org/app:main', 'ghcr.io', false],
    ['ghcr.io/org/app:Nightly', 'ghcr.io', false],
    ['ghcr.io/org/app:3f9c2ab', 'ghcr.io', true],
    ['ghcr.io/org/app@sha256:abc', 'ghcr.io', true],
    ['ghcr.io/org/app:main@sha256:abc', 'ghcr.io', true],
  ])('%s', (image, registry, pinned) => {
    expect(parseImage(image)).toEqual({ registry, pinned });
  });
});

describe('isSecretLikeKey', () => {
  it.each([
    'DB_PASS',
    'DB_PASSWORD',
    'DB_PWD',
    'GITHUB_TOKEN',
    'STRIPE_API_KEY',
    'APIKEY',
    'TLS_PRIVATE_KEY',
    'client-secret',
    'AWS_CREDENTIALS',
  ])('matches %s', key => {
    expect(isSecretLikeKey(key)).toBe(true);
  });

  it.each([
    'TOKEN_URL',
    'PASSWORD_FILE',
    'SECRET_NAME',
    'PASSPORT_ID',
    'PWD',
    'KEYCLOAK_REALM',
    'LOG_LEVEL',
  ])('does not match %s', key => {
    expect(isSecretLikeKey(key)).toBe(false);
  });
});

describe('plainTextSecretEnvCount', () => {
  it('counts each plain secret once across lists', () => {
    expect(
      plainTextSecretEnvCount([
        [
          { key: 'DB_PASS', value: 'a' },
          { key: 'API_TOKEN', valueFrom: { secretKeyRef: {} } },
        ],
        [
          { key: 'DB_PASS', value: 'b' },
          { key: 'API_TOKEN', value: 'plain' },
        ],
      ]),
    ).toBe(2);
  });
});

describe('lineBindings', () => {
  const main = { spec: { environment: 'development' } };
  const unnamed = {
    spec: { owner: { releaseLine: '' }, environment: 'staging' },
  };
  const next = {
    spec: { owner: { releaseLine: 'next' }, environment: 'production' },
  };
  const canary = {
    spec: { owner: { releaseLine: 'canary' }, environment: 'production' },
  };

  it("keeps the main line's bindings when no line is named", () => {
    expect(lineBindings([main, unnamed, next, canary])).toEqual([
      main,
      unnamed,
    ]);
  });

  it("keeps only the named line's bindings", () => {
    expect(lineBindings([main, next, canary], 'next')).toEqual([next]);
  });
});

describe('activeBindings', () => {
  it('leaves out bindings that undeploy their release', () => {
    const deployed = { spec: { environment: 'development' } };
    const explicit = { spec: { environment: 'staging', state: 'Active' } };
    const undeployed = { spec: { environment: 'qa', state: 'Undeploy' } };
    expect(activeBindings([deployed, explicit, undeployed])).toEqual([
      deployed,
      explicit,
    ]);
  });
});

describe('everyReleaseRead', () => {
  const manage = (environment: string, releaseName?: string) => ({
    spec: { environment, releaseName },
  });
  const observe = (environment: string, releaseName: string) => ({
    spec: { environment, releaseName, mode: 'Observe' },
  });
  const releases = new Map<string, ReleasedWorkload | undefined>([
    ['r1', { container: { image: 'ghcr.io/acme/api:1.0.0' } }],
    ['r2', {}],
    ['gone', undefined],
  ]);

  it.each([
    [
      'every rendering binding on a read release',
      [manage('dev', 'r1'), manage('prod', 'r2')],
      true,
    ],
    [
      'an Observe binding beside one on a read release',
      [manage('dev', 'r1'), observe('prod', 'gone')],
      true,
    ],
    [
      'one release read and one missing',
      [manage('dev', 'r1'), manage('prod', 'gone')],
      false,
    ],
    [
      'a release never requested',
      [manage('dev', 'r1'), manage('prod', 'r9')],
      false,
    ],
    [
      'a binding that names no release',
      [manage('dev', 'r1'), manage('prod')],
      false,
    ],
    [
      'only Observe bindings',
      [observe('dev', 'r1'), observe('prod', 'r2')],
      false,
    ],
    ['no bindings', [], false],
  ])('%s', (_label, bindings: ReleaseBinding[], expected) => {
    expect(everyReleaseRead(bindings, releases)).toBe(expected);
  });
});

describe('environmentDeployment', () => {
  const synced = { type: 'ReleaseSynced', status: 'True' };
  const ready = { conditions: [synced, { type: 'Ready', status: 'True' }] };
  const production = new Set(['production']);
  const release = {
    container: {
      image: 'ghcr.io/acme/api:1.2.0',
      env: [
        { key: 'LOG_LEVEL', value: 'debug' },
        { key: 'GITHUB_TOKEN', valueFrom: { secretKeyRef: {} } },
        { key: 'DB_PASSWORD', value: 'hunter2' },
      ],
    },
  };
  const binding = (
    spec: Partial<NonNullable<ReleaseBinding['spec']>>,
    status: ReleaseBinding['status'] = ready,
  ): ReleaseBinding => ({
    spec: { environment: 'production', releaseName: 'r2', ...spec },
    status,
  });

  it('describes a synced, ready binding on the latest release', () => {
    expect(
      environmentDeployment({
        binding: binding({}),
        productionEnvironments: production,
        latestRelease: 'r2',
        release,
        externalEndpoints: new Map([['production', 2]]),
      }),
    ).toEqual({
      environment: 'production',
      isProduction: true,
      isReleaseSynced: true,
      isReady: true,
      isOnLatestRelease: true,
      plainTextSecretEnvVarCount: 1,
      isImagePinned: true,
      imageRegistry: 'ghcr.io',
      externalEndpointCount: 2,
    });
  });

  it('flags an unsynced, unready binding on an older release', () => {
    expect(
      environmentDeployment({
        binding: binding(
          { environment: 'development', releaseName: 'r1' },
          {
            conditions: [
              { type: 'ReleaseSynced', status: 'False' },
              { type: 'Ready', status: 'False' },
            ],
          },
        ),
        productionEnvironments: production,
        latestRelease: 'r2',
      }),
    ).toEqual({
      environment: 'development',
      isProduction: false,
      isReleaseSynced: false,
      isReady: false,
      isOnLatestRelease: false,
    });
  });

  it('reports readiness apart from the latest release', () => {
    expect(
      environmentDeployment({
        binding: binding(
          {},
          { conditions: [synced, { type: 'Ready', status: 'False' }] },
        ),
        productionEnvironments: production,
        latestRelease: 'r2',
      }),
    ).toMatchObject({ isReleaseSynced: true, isReady: false });
  });

  it('leaves out isOnLatestRelease without a recorded latest release', () => {
    expect(
      environmentDeployment({
        binding: binding({}),
        productionEnvironments: production,
      }),
    ).not.toHaveProperty('isOnLatestRelease');
  });

  it("counts the release's plain secrets with this binding's own overrides", () => {
    expect(
      environmentDeployment({
        binding: binding({
          workloadOverrides: {
            container: {
              env: [
                { key: 'DB_PASSWORD', value: 'other' },
                { key: 'API_TOKEN', value: 'plain' },
                { key: 'SIGNING_SECRET', valueFrom: { secretKeyRef: {} } },
              ],
            },
          },
        }),
        productionEnvironments: production,
        release,
      }),
    ).toHaveProperty('plainTextSecretEnvVarCount', 2);
  });

  it('reads the image from the release, not the current Workload', () => {
    expect(
      environmentDeployment({
        binding: binding({}),
        productionEnvironments: production,
        release: { container: { image: 'nginx:latest' } },
      }),
    ).toMatchObject({
      isImagePinned: false,
      imageRegistry: 'docker.io',
      plainTextSecretEnvVarCount: 0,
    });
  });

  it('leaves out the registry when the release names no image', () => {
    const entry = environmentDeployment({
      binding: binding({}),
      productionEnvironments: production,
      release: { container: {} },
    });
    expect(entry).toMatchObject({
      isImagePinned: false,
      plainTextSecretEnvVarCount: 0,
    });
    expect(entry).not.toHaveProperty('imageRegistry');
  });

  it('leaves out the image and secret fields when the release is unknown', () => {
    const entry = environmentDeployment({
      binding: binding({}),
      productionEnvironments: production,
      latestRelease: 'r2',
    });
    expect(entry).not.toHaveProperty('isImagePinned');
    expect(entry).not.toHaveProperty('imageRegistry');
    expect(entry).not.toHaveProperty('plainTextSecretEnvVarCount');
    expect(entry).toHaveProperty('isOnLatestRelease', true);
  });

  it('counts no external endpoints for an environment none is bound to', () => {
    expect(
      environmentDeployment({
        binding: binding({ environment: 'staging' }),
        productionEnvironments: production,
        externalEndpoints: new Map([['production', 1]]),
      }),
    ).toHaveProperty('externalEndpointCount', 0);
  });

  it('leaves out externalEndpointCount when Endpoints are unknown', () => {
    expect(
      environmentDeployment({
        binding: binding({}),
        productionEnvironments: production,
      }),
    ).not.toHaveProperty('externalEndpointCount');
  });

  it('describes a Manage binding from its release without naming the mode', () => {
    const entry = environmentDeployment({
      binding: binding({ mode: 'Manage' }),
      productionEnvironments: production,
      release,
    });
    expect(entry).not.toHaveProperty('mode');
    expect(entry).toHaveProperty('isImagePinned', true);
  });

  it('leaves out the fields an Observe binding does not render', () => {
    expect(
      environmentDeployment({
        binding: binding({ mode: 'Observe' }),
        productionEnvironments: production,
        latestRelease: 'r2',
        release,
        externalEndpoints: new Map([['production', 1]]),
      }),
    ).toEqual({
      environment: 'production',
      isProduction: true,
      isReleaseSynced: true,
      isReady: true,
      externalEndpointCount: 1,
    });
  });
});

describe('lineExternalEndpoints', () => {
  const endpoint = (
    name: string,
    owner: NonNullable<Endpoint['spec']>['owner'],
    visibility = ['external'],
  ): Endpoint => ({ metadata: { name }, spec: { owner, visibility } });
  const endpoints = [
    endpoint('api-public', { projectName: 'shop', componentName: 'api' }),
    endpoint('api-internal', { projectName: 'shop', componentName: 'api' }, [
      'project',
      'internal',
    ]),
    endpoint('api-next-public', {
      projectName: 'shop',
      componentName: 'api',
      releaseLineName: 'next',
    }),
    endpoint('web-public', { projectName: 'shop', componentName: 'web' }),
    endpoint('shared', { projectName: 'shop' }),
  ];
  const names = (list: Endpoint[]) => list.map(e => e.metadata.name);

  it("keeps the main line's external Endpoints", () => {
    expect(names(lineExternalEndpoints(endpoints, 'api'))).toEqual([
      'api-public',
    ]);
  });

  it("keeps a release line's own external Endpoints", () => {
    expect(names(lineExternalEndpoints(endpoints, 'api', 'next'))).toEqual([
      'api-next-public',
    ]);
  });
});

describe('endpointsPerEnvironment', () => {
  it('counts each Endpoint once per environment it is bound in', () => {
    const erb = (
      endpointName: string,
      environment: string,
      project = 'shop',
    ) => ({
      spec: { owner: { projectName: project, endpointName }, environment },
    });
    expect(
      endpointsPerEnvironment(
        'shop',
        ['api-public', 'api-admin', 'api-docs'],
        [
          erb('api-public', 'development'),
          erb('api-public', 'production'),
          erb('api-admin', 'development'),
          erb('api-admin', 'development'),
          erb('api-admin', 'production', 'other'),
          erb('web-public', 'production'),
          { spec: { owner: { projectName: 'shop' }, environment: 'qa' } },
        ],
      ),
    ).toEqual(
      new Map([
        ['development', 2],
        ['production', 1],
      ]),
    );
  });
});
