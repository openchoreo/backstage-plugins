/**
 * Minimal OCI distribution client: resolves tags to digests and reads the
 * cosign attestation manifest stored next to an image.
 *
 * Registries that require authentication are expected to use the Docker
 * token flow (as GitLab, Harbor and most others do): the first request
 * answers 401 with a Bearer challenge, the client fetches a token from the
 * realm with basic credentials and retries.
 */

export interface RegistryConfig {
  /** Host as it appears in image references, e.g. `registry.example.com:5000`. */
  host: string;
  /** Base URL the backend uses to reach it. Defaults to `https://<host>`. */
  url?: string;
  username?: string;
  password?: string;
  /** Overrides the token realm announced by the registry. */
  tokenRealm?: string;
}

export interface ImageRef {
  registry: string;
  repository: string;
  tag?: string;
  digest?: string;
}

export interface OciDescriptor {
  mediaType: string;
  digest: string;
  size: number;
  annotations?: Record<string, string>;
}

export interface OciManifest {
  mediaType?: string;
  layers: OciDescriptor[];
}

const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

export class RegistryNotFoundError extends Error {}

/** Splits `host[:port]/repo/path[:tag][@sha256:…]`. */
export function parseImageRef(image: string): ImageRef {
  let rest = image;
  let digest: string | undefined;
  const at = rest.indexOf('@');
  if (at >= 0) {
    digest = rest.slice(at + 1);
    rest = rest.slice(0, at);
  }
  const slash = rest.indexOf('/');
  if (slash < 0) {
    throw new Error(`image reference without registry host: ${image}`);
  }
  const registry = rest.slice(0, slash);
  let repository = rest.slice(slash + 1);
  let tag: string | undefined;
  const colon = repository.lastIndexOf(':');
  if (colon >= 0) {
    tag = repository.slice(colon + 1);
    repository = repository.slice(0, colon);
  }
  return { registry, repository, tag, digest };
}

/** cosign stores attestations under the tag `sha256-<hex>.att`. */
export function attestationTag(digest: string): string {
  return `${digest.replace(':', '-')}.att`;
}

function parseChallenge(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [, key, value] of header.matchAll(/(\w+)="([^"]*)"/g)) {
    params[key] = value;
  }
  return params;
}

export class RegistryClient {
  private readonly baseUrl: string;
  private readonly tokens = new Map<
    string,
    { token: string; expires: number }
  >();

  constructor(
    private readonly config: RegistryConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.baseUrl = (config.url ?? `https://${config.host}`).replace(/\/$/, '');
  }

  /** Resolves a tag to the digest of its manifest. */
  async resolveDigest(repository: string, reference: string): Promise<string> {
    const res = await this.request(
      repository,
      `/v2/${repository}/manifests/${reference}`,
      { method: 'HEAD', headers: { Accept: MANIFEST_ACCEPT } },
    );
    const digest = res.headers.get('docker-content-digest');
    if (!digest) {
      throw new Error(
        `registry returned no digest for ${repository}:${reference}`,
      );
    }
    return digest;
  }

  async getManifest(
    repository: string,
    reference: string,
  ): Promise<OciManifest> {
    const res = await this.request(
      repository,
      `/v2/${repository}/manifests/${reference}`,
      { headers: { Accept: MANIFEST_ACCEPT } },
    );
    return (await res.json()) as OciManifest;
  }

  async getBlob(repository: string, digest: string): Promise<Buffer> {
    const res = await this.request(
      repository,
      `/v2/${repository}/blobs/${digest}`,
    );
    return Buffer.from(await res.arrayBuffer());
  }

  private async request(
    repository: string,
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const cached = this.tokens.get(repository);
    const headers = new Headers(init.headers);
    if (cached && cached.expires > Date.now()) {
      headers.set('Authorization', `Bearer ${cached.token}`);
    }

    let res = await this.fetchImpl(url, { ...init, headers });
    if (res.status === 401) {
      const token = await this.fetchToken(
        repository,
        res.headers.get('www-authenticate') ?? '',
      );
      headers.set('Authorization', `Bearer ${token}`);
      res = await this.fetchImpl(url, { ...init, headers });
    }
    if (res.status === 404) {
      throw new RegistryNotFoundError(`${path} not found`);
    }
    if (!res.ok) {
      throw new Error(`registry request ${path} failed: ${res.status}`);
    }
    return res;
  }

  private async fetchToken(
    repository: string,
    challenge: string,
  ): Promise<string> {
    if (!challenge.toLowerCase().startsWith('bearer')) {
      throw new Error(
        `unsupported registry auth challenge: ${challenge || 'none'}`,
      );
    }
    const params = parseChallenge(challenge);
    const realm = this.config.tokenRealm ?? params.realm;
    if (!realm) {
      throw new Error('registry auth challenge without realm');
    }
    const tokenUrl = new URL(realm);
    if (params.service) tokenUrl.searchParams.set('service', params.service);
    tokenUrl.searchParams.set('scope', `repository:${repository}:pull`);

    const headers: Record<string, string> = {};
    if (this.config.username && this.config.password) {
      headers.Authorization = `Basic ${Buffer.from(
        `${this.config.username}:${this.config.password}`,
      ).toString('base64')}`;
    }
    const res = await this.fetchImpl(tokenUrl.toString(), { headers });
    if (!res.ok) {
      throw new Error(`registry token request failed: ${res.status}`);
    }
    const body = (await res.json()) as {
      token?: string;
      access_token?: string;
      expires_in?: number;
    };
    const token = body.token ?? body.access_token;
    if (!token) {
      throw new Error('registry token response without token');
    }
    // Renew a little early; GitLab issues 5 minute tokens.
    const ttl = Math.max((body.expires_in ?? 300) - 30, 30);
    this.tokens.set(repository, { token, expires: Date.now() + ttl * 1000 });
    return token;
  }
}
