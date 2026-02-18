import type {
  OpenChoreoComponents,
  OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  getName,
  getNamespace,
  getCreatedAt,
  getDisplayName,
  getDescription,
  deriveStatus,
} from './common';

type SecretReference = OpenChoreoComponents['schemas']['SecretReference'];
type SecretReferenceResponse =
  OpenChoreoLegacyComponents['schemas']['SecretReferenceResponse'];

export function transformSecretReference(
  secret: SecretReference,
): SecretReferenceResponse {
  return {
    name: getName(secret) ?? '',
    namespace: getNamespace(secret) ?? '',
    displayName: getDisplayName(secret),
    description: getDescription(secret),
    secretStores: secret.status?.secretStores?.map(store => ({
      name: store.name,
      namespace: store.namespace ?? '',
      kind: store.kind,
    })),
    refreshInterval: secret.spec?.refreshInterval,
    data: secret.spec?.data?.map(d => ({
      secretKey: d.secretKey,
      remoteRef: {
        key: d.remoteRef.key,
        property: d.remoteRef.property,
        version: d.remoteRef.version,
      },
    })),
    createdAt: getCreatedAt(secret) ?? '',
    lastRefreshTime: secret.status?.lastRefreshTime,
    status: deriveStatus(secret) ?? '',
  };
}
