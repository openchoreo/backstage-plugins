import {
  createApiRef,
  DiscoveryApi,
  FetchApi,
} from '@backstage/core-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

// Mirrors the response of openchoreo-image-security-backend.

export interface Vulnerability {
  id: string;
  severity: string;
  packageName: string;
  installedVersion: string;
  fixedVersion: string;
  title?: string;
  url?: string;
  target?: string;
}

export interface VulnerabilityReport {
  scannedAt?: string;
  scanner?: string;
  counts: Record<string, number>;
  vulnerabilities: Vulnerability[];
  verified: boolean;
}

export type ImageSecurityStatus =
  | 'ok'
  | 'findings'
  | 'unverified'
  | 'not-scanned'
  | 'error';

export interface EnvironmentImageSecurity {
  environment: string;
  releaseName?: string;
  image?: string;
  digest?: string;
  status: ImageSecurityStatus;
  report?: VulnerabilityReport;
  message?: string;
}

export interface ComponentImageSecurity {
  severities: string[];
  environments: EnvironmentImageSecurity[];
}

export interface ImageSecurityApi {
  getComponentImageSecurity(entity: Entity): Promise<ComponentImageSecurity>;
}

export const imageSecurityApiRef = createApiRef<ImageSecurityApi>({
  id: 'plugin.openchoreo-image-security.client',
});

export class ImageSecurityClient implements ImageSecurityApi {
  constructor(
    private readonly discovery: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  async getComponentImageSecurity(
    entity: Entity,
  ): Promise<ComponentImageSecurity> {
    const annotations = entity.metadata.annotations ?? {};
    const componentName = annotations[CHOREO_ANNOTATIONS.COMPONENT];
    const namespaceName = annotations[CHOREO_ANNOTATIONS.NAMESPACE];
    if (!componentName || !namespaceName) {
      throw new Error('Entity is not an OpenChoreo component');
    }

    const baseUrl = await this.discovery.getBaseUrl(
      'openchoreo-image-security-backend',
    );
    const params = new URLSearchParams({ componentName, namespaceName });
    const res = await this.fetchApi.fetch(
      `${baseUrl}/vulnerabilities?${params}`,
    );
    if (!res.ok) {
      throw new Error(
        `Failed to load image security: ${res.status} ${res.statusText}`,
      );
    }
    return (await res.json()) as ComponentImageSecurity;
  }
}
