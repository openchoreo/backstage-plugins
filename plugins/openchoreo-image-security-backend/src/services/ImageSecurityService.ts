import { LoggerService } from '@backstage/backend-plugin-api';
import { KeyObject } from 'crypto';
import {
  assertApiResponse,
  createOpenChoreoApiClient,
} from '@openchoreo/openchoreo-client-node';
import {
  RegistryClient,
  RegistryConfig,
  RegistryNotFoundError,
  attestationTag,
  parseImageRef,
} from './registry';
import {
  DsseEnvelope,
  VULN_PREDICATE_TYPE,
  decodeStatement,
  statementCoversDigest,
  summarizeVulnPredicate,
  verifyEnvelope,
} from './attestation';
import type {
  ComponentImageSecurity,
  EnvironmentImageSecurity,
  VulnerabilityReport,
} from '../types';

export interface ImageSecurityOptions {
  baseUrl: string;
  registries: RegistryConfig[];
  publicKey?: KeyObject;
  severities: string[];
  cacheTtlSeconds: number;
}

type DigestResult =
  | { status: 'not-scanned' }
  | { status: 'unverified'; report: VulnerabilityReport }
  | { status: 'ok' | 'findings'; report: VulnerabilityReport };

export class ImageSecurityService {
  private readonly clients = new Map<string, RegistryClient>();
  private readonly cache = new Map<
    string,
    { value: DigestResult; expires: number }
  >();

  constructor(
    private readonly logger: LoggerService,
    private readonly options: ImageSecurityOptions,
  ) {
    for (const registry of options.registries) {
      this.clients.set(registry.host, new RegistryClient(registry));
    }
  }

  async getComponentImageSecurity(
    namespaceName: string,
    componentName: string,
    token?: string,
  ): Promise<ComponentImageSecurity> {
    const client = createOpenChoreoApiClient({
      baseUrl: this.options.baseUrl,
      token,
      logger: this.logger,
    });

    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/releasebindings',
      {
        params: {
          path: { namespaceName },
          query: { component: componentName },
        },
      },
    );
    assertApiResponse({ data, error, response }, 'fetch release bindings');

    const environments = await Promise.all(
      data!.items.map(async (binding): Promise<EnvironmentImageSecurity> => {
        const environment = binding.spec?.environment ?? 'unknown';
        const releaseName = binding.spec?.releaseName;
        if (!releaseName) {
          return {
            environment,
            status: 'not-scanned',
            message: 'Not released yet',
          };
        }
        try {
          const image = await this.getReleaseImage(
            client,
            namespaceName,
            releaseName,
          );
          return {
            environment,
            releaseName,
            image,
            ...(await this.inspectImage(image)),
          };
        } catch (e) {
          this.logger.warn(
            `Image security for ${namespaceName}/${componentName} in ${environment}: ${e}`,
          );
          return {
            environment,
            releaseName,
            status: 'error',
            message: e instanceof Error ? e.message : String(e),
          };
        }
      }),
    );

    environments.sort((a, b) => a.environment.localeCompare(b.environment));
    return { severities: this.options.severities, environments };
  }

  private async getReleaseImage(
    client: ReturnType<typeof createOpenChoreoApiClient>,
    namespaceName: string,
    componentReleaseName: string,
  ): Promise<string> {
    const { data, error, response } = await client.GET(
      '/api/v1/namespaces/{namespaceName}/componentreleases/{componentReleaseName}',
      { params: { path: { namespaceName, componentReleaseName } } },
    );
    assertApiResponse({ data, error, response }, 'fetch component release');
    const image = (data!.spec?.workload as any)?.container?.image;
    if (typeof image !== 'string' || !image) {
      throw new Error(`release ${componentReleaseName} has no container image`);
    }
    return image;
  }

  private async inspectImage(
    image: string,
  ): Promise<
    Omit<EnvironmentImageSecurity, 'environment' | 'releaseName' | 'image'>
  > {
    const ref = parseImageRef(image);
    const registry = this.clients.get(ref.registry);
    if (!registry) {
      return {
        status: 'not-scanned',
        message: `Registry ${ref.registry} is not configured`,
      };
    }

    const digest =
      ref.digest ??
      (await registry.resolveDigest(ref.repository, ref.tag ?? 'latest'));

    const cached = this.cache.get(digest);
    let result: DigestResult;
    if (cached && cached.expires > Date.now()) {
      result = cached.value;
    } else {
      result = await this.readVulnAttestation(registry, ref.repository, digest);
      this.cache.set(digest, {
        value: result,
        expires: Date.now() + this.options.cacheTtlSeconds * 1000,
      });
    }

    if (result.status === 'not-scanned') {
      return {
        digest,
        status: 'not-scanned',
        message: 'No vulnerability scan attached',
      };
    }
    return { digest, status: result.status, report: result.report };
  }

  private async readVulnAttestation(
    registry: RegistryClient,
    repository: string,
    digest: string,
  ): Promise<DigestResult> {
    let manifest;
    try {
      manifest = await registry.getManifest(repository, attestationTag(digest));
    } catch (e) {
      if (e instanceof RegistryNotFoundError) return { status: 'not-scanned' };
      throw e;
    }

    // cosign annotates each layer with its predicate type; layers without the
    // annotation are inspected too, in case another tool wrote them.
    const layers = manifest.layers.filter(
      l =>
        !l.annotations?.predicateType ||
        l.annotations.predicateType === VULN_PREDICATE_TYPE,
    );

    let best: { report: VulnerabilityReport; verified: boolean } | undefined;
    for (const layer of layers) {
      const envelope = JSON.parse(
        (await registry.getBlob(repository, layer.digest)).toString('utf8'),
      ) as DsseEnvelope;
      const statement = decodeStatement(envelope);
      if (
        statement.predicateType !== VULN_PREDICATE_TYPE ||
        !statementCoversDigest(statement, digest)
      ) {
        continue;
      }
      const verified = this.options.publicKey
        ? verifyEnvelope(envelope, this.options.publicKey)
        : false;
      const report: VulnerabilityReport = {
        ...summarizeVulnPredicate(statement.predicate, this.options.severities),
        verified,
      };
      // Prefer verified reports, then the most recent scan.
      if (
        !best ||
        (verified && !best.verified) ||
        (verified === best.verified &&
          (report.scannedAt ?? '') > (best.report.scannedAt ?? ''))
      ) {
        best = { report, verified };
      }
    }

    if (!best) return { status: 'not-scanned' };
    if (this.options.publicKey && !best.verified) {
      return { status: 'unverified', report: best.report };
    }
    return {
      status: best.report.vulnerabilities.length > 0 ? 'findings' : 'ok',
      report: best.report,
    };
  }
}
