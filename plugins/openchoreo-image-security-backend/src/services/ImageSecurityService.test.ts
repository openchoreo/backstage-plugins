import { mockServices } from '@backstage/backend-test-utils';
import { KeyObject, createHash, generateKeyPairSync, sign } from 'crypto';
import { createOpenChoreoApiClient } from '@openchoreo/openchoreo-client-node';
import { ImageSecurityService } from './ImageSecurityService';
import { DsseEnvelope, VULN_PREDICATE_TYPE, pae } from './attestation';

jest.mock('@openchoreo/openchoreo-client-node', () => ({
  ...jest.requireActual('@openchoreo/openchoreo-client-node'),
  createOpenChoreoApiClient: jest.fn(),
}));

const HOST = 'registry.example.com';
const REPO = 'acme/web';
const DIGEST = `sha256:${'a'.repeat(64)}`;
const ATT_TAG = `sha256-${'a'.repeat(64)}.att`;

const predicate = {
  scanner: {
    uri: 'pkg:github/aquasecurity/trivy@0.69.3',
    version: '0.69.3',
    result: {
      Results: [
        {
          Target: 'app',
          Vulnerabilities: [
            {
              VulnerabilityID: 'CVE-2026-0001',
              PkgName: 'busybox',
              InstalledVersion: '1.36.1-r29',
              FixedVersion: '1.36.1-r30',
              Severity: 'CRITICAL',
            },
          ],
        },
      ],
    },
  },
  metadata: { scanFinishedOn: '2026-10-12T12:00:00Z' },
};

function envelope(
  privateKey: KeyObject,
  { digest = DIGEST, findings = true } = {},
): DsseEnvelope {
  const statement = {
    _type: 'https://in-toto.io/Statement/v0.1',
    subject: [
      { name: `${HOST}/${REPO}`, digest: { sha256: digest.split(':')[1] } },
    ],
    predicateType: VULN_PREDICATE_TYPE,
    predicate: findings
      ? predicate
      : { ...predicate, scanner: { ...predicate.scanner, result: {} } },
  };
  const payload = Buffer.from(JSON.stringify(statement));
  const payloadType = 'application/vnd.in-toto+json';
  return {
    payloadType,
    payload: payload.toString('base64'),
    signatures: [
      {
        keyid: '',
        sig: sign('sha256', pae(payloadType, payload), privateKey).toString(
          'base64',
        ),
      },
    ],
  };
}

/**
 * In-memory OCI registry behind a Docker token challenge. `blobs` are the
 * layers of the attestation manifest; omit them to answer 404 for it.
 */
function fakeRegistry(blobs?: Buffer[], tags: Record<string, string> = {}) {
  const layers = (blobs ?? []).map(b => ({
    mediaType: 'application/vnd.dsse.envelope.v1+json',
    digest: `sha256:${createHash('sha256').update(b).digest('hex')}`,
    size: b.length,
  }));
  const fetchMock = jest.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (url.hostname === 'auth.example.com') {
        return Response.json({ token: 'pull-token', expires_in: 300 });
      }
      const auth = new Headers(init?.headers).get('Authorization');
      if (auth !== 'Bearer pull-token') {
        return new Response(null, {
          status: 401,
          headers: {
            'www-authenticate': `Bearer realm="https://auth.example.com/token",service="${HOST}"`,
          },
        });
      }
      const manifest = url.pathname.match(/^\/v2\/(.+)\/manifests\/(.+)$/);
      if (manifest) {
        const [, , reference] = manifest;
        if (init?.method === 'HEAD' && tags[reference]) {
          return new Response(null, {
            headers: { 'docker-content-digest': tags[reference] },
          });
        }
        if (reference === ATT_TAG && blobs) {
          return Response.json({ layers });
        }
        return new Response(null, { status: 404 });
      }
      const blob = url.pathname.match(/\/blobs\/(.+)$/);
      const index = blob ? layers.findIndex(l => l.digest === blob[1]) : -1;
      if (index >= 0) return new Response(blobs![index]);
      return new Response(null, { status: 404 });
    },
  );
  jest.spyOn(global, 'fetch').mockImplementation(fetchMock as typeof fetch);
  return fetchMock;
}

function mockReleases(
  bindings: { environment: string; releaseName?: string }[],
  image = `${HOST}/${REPO}@${DIGEST}`,
) {
  const GET = jest.fn(async (path: string) => {
    const response = new Response(null, { status: 200 });
    if (path.endsWith('/releasebindings')) {
      return {
        data: { items: bindings.map(spec => ({ spec })) },
        response,
      };
    }
    return {
      data: { spec: { workload: { container: { image } } } },
      response,
    };
  });
  (createOpenChoreoApiClient as jest.Mock).mockReturnValue({ GET });
  return GET;
}

describe('ImageSecurityService', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });

  function service(options: { publicKey?: KeyObject; registry?: string } = {}) {
    return new ImageSecurityService(mockServices.logger.mock(), {
      baseUrl: 'http://openchoreo-api',
      registries: [{ host: options.registry ?? HOST }],
      publicKey: 'publicKey' in options ? options.publicKey : publicKey,
      severities: ['CRITICAL', 'HIGH'],
      cacheTtlSeconds: 300,
    });
  }

  afterEach(() => jest.restoreAllMocks());

  it('reports verified findings per environment, sorted by name', async () => {
    fakeRegistry([Buffer.from(JSON.stringify(envelope(privateKey)))]);
    mockReleases([
      { environment: 'production', releaseName: 'web-r2' },
      { environment: 'development', releaseName: 'web-r1' },
      { environment: 'staging' },
    ]);

    const result = await service().getComponentImageSecurity('acme', 'web');

    expect(result.severities).toEqual(['CRITICAL', 'HIGH']);
    expect(result.environments.map(e => [e.environment, e.status])).toEqual([
      ['development', 'findings'],
      ['production', 'findings'],
      ['staging', 'not-scanned'],
    ]);
    const dev = result.environments[0];
    expect(dev.digest).toBe(DIGEST);
    expect(dev.report?.verified).toBe(true);
    expect(dev.report?.vulnerabilities.map(v => v.id)).toEqual([
      'CVE-2026-0001',
    ]);
  });

  it('reports ok for a signed scan without fixable findings', async () => {
    fakeRegistry([
      Buffer.from(JSON.stringify(envelope(privateKey, { findings: false }))),
    ]);
    mockReleases([{ environment: 'dev', releaseName: 'r1' }]);

    const [env] = (await service().getComponentImageSecurity('acme', 'web'))
      .environments;

    expect(env.status).toBe('ok');
  });

  it('resolves a tag to its digest', async () => {
    const fetchMock = fakeRegistry(
      [Buffer.from(JSON.stringify(envelope(privateKey)))],
      { v1: DIGEST },
    );
    mockReleases(
      [{ environment: 'dev', releaseName: 'r1' }],
      `${HOST}/${REPO}:v1`,
    );

    const [env] = (await service().getComponentImageSecurity('acme', 'web'))
      .environments;

    expect(env.digest).toBe(DIGEST);
    expect(env.status).toBe('findings');
    const tokenCall = fetchMock.mock.calls.find(([u]) =>
      String(u).startsWith('https://auth.example.com'),
    );
    expect(new URL(String(tokenCall![0])).searchParams.get('scope')).toBe(
      `repository:${REPO}:pull`,
    );
  });

  it('marks a scan unverified when no public key is configured', async () => {
    fakeRegistry([Buffer.from(JSON.stringify(envelope(privateKey)))]);
    mockReleases([{ environment: 'dev', releaseName: 'r1' }]);

    const [env] = (
      await service({ publicKey: undefined }).getComponentImageSecurity(
        'acme',
        'web',
      )
    ).environments;

    expect(env.status).toBe('unverified');
    expect(env.report?.verified).toBe(false);
  });

  it('marks a scan signed with another key unverified', async () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    fakeRegistry([Buffer.from(JSON.stringify(envelope(other.privateKey)))]);
    mockReleases([{ environment: 'dev', releaseName: 'r1' }]);

    const [env] = (await service().getComponentImageSecurity('acme', 'web'))
      .environments;

    expect(env.status).toBe('unverified');
  });

  it('skips layers that are not DSSE envelopes', async () => {
    fakeRegistry([
      Buffer.from('not json'),
      Buffer.from(JSON.stringify({ payload: 'bm90IGpzb24=' })),
      Buffer.from(JSON.stringify(envelope(privateKey))),
    ]);
    mockReleases([{ environment: 'dev', releaseName: 'r1' }]);

    const [env] = (await service().getComponentImageSecurity('acme', 'web'))
      .environments;

    expect(env.status).toBe('findings');
  });

  it('ignores statements about another digest', async () => {
    fakeRegistry([
      Buffer.from(
        JSON.stringify(
          envelope(privateKey, { digest: `sha256:${'b'.repeat(64)}` }),
        ),
      ),
    ]);
    mockReleases([{ environment: 'dev', releaseName: 'r1' }]);

    const [env] = (await service().getComponentImageSecurity('acme', 'web'))
      .environments;

    expect(env.status).toBe('not-scanned');
  });

  it('reports not-scanned when no attestation exists', async () => {
    fakeRegistry();
    mockReleases([{ environment: 'dev', releaseName: 'r1' }]);

    const [env] = (await service().getComponentImageSecurity('acme', 'web'))
      .environments;

    expect(env.status).toBe('not-scanned');
    expect(env.message).toBe('No vulnerability scan attached');
  });

  it('reports not-scanned for an unconfigured registry', async () => {
    const fetchMock = fakeRegistry();
    mockReleases([{ environment: 'dev', releaseName: 'r1' }]);

    const [env] = (
      await service({
        registry: 'other.example.com',
      }).getComponentImageSecurity('acme', 'web')
    ).environments;

    expect(env.status).toBe('not-scanned');
    expect(env.message).toContain(HOST);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an error for a release without image', async () => {
    fakeRegistry();
    mockReleases([{ environment: 'dev', releaseName: 'r1' }], '');

    const [env] = (await service().getComponentImageSecurity('acme', 'web'))
      .environments;

    expect(env.status).toBe('error');
    expect(env.message).toContain('has no container image');
  });

  it('caches per repository and digest', async () => {
    const fetchMock = fakeRegistry([
      Buffer.from(JSON.stringify(envelope(privateKey))),
    ]);
    const svc = service();
    const manifestCalls = () =>
      fetchMock.mock.calls.filter(([u]) => String(u).includes(ATT_TAG)).length;

    mockReleases([{ environment: 'dev', releaseName: 'r1' }]);
    await svc.getComponentImageSecurity('acme', 'web');
    const afterFirst = manifestCalls();
    await svc.getComponentImageSecurity('acme', 'web');
    expect(manifestCalls()).toBe(afterFirst);

    // Same digest, different repository: a separate lookup.
    mockReleases(
      [{ environment: 'dev', releaseName: 'r1' }],
      `${HOST}/acme/api@${DIGEST}`,
    );
    await svc.getComponentImageSecurity('acme', 'api');
    expect(manifestCalls()).toBeGreaterThan(afterFirst);
  });

  it('propagates release binding errors', async () => {
    (createOpenChoreoApiClient as jest.Mock).mockReturnValue({
      GET: jest.fn().mockResolvedValue({
        error: { message: 'forbidden' },
        response: new Response(null, { status: 403 }),
      }),
    });

    await expect(
      service().getComponentImageSecurity('acme', 'web'),
    ).rejects.toThrow();
  });
});
