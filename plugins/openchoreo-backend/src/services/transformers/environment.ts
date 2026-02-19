import type {
  OpenChoreoComponents,
  OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  getName,
  getNamespace,
  getUid,
  getCreatedAt,
  getDisplayName,
  getDescription,
  deriveStatus,
} from './common';

type Environment = OpenChoreoComponents['schemas']['Environment'];
type EnvironmentResponse =
  OpenChoreoLegacyComponents['schemas']['EnvironmentResponse'];

export function transformEnvironment(
  environment: Environment,
): EnvironmentResponse {
  return {
    uid: getUid(environment) ?? '',
    name: getName(environment) ?? '',
    namespace: getNamespace(environment) ?? '',
    displayName: getDisplayName(environment),
    description: getDescription(environment),
    dataPlaneRef: environment.spec?.dataPlaneRef
      ? {
          kind: environment.spec.dataPlaneRef.kind,
          name: environment.spec.dataPlaneRef.name,
        }
      : undefined,
    isProduction: environment.spec?.isProduction ?? false,
    dnsPrefix: environment.spec?.gateway?.publicVirtualHost,
    createdAt: getCreatedAt(environment) ?? '',
    status: deriveStatus(environment),
  };
}
