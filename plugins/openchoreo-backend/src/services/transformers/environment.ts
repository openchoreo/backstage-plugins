import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { EnvironmentResponse } from '@openchoreo/backstage-plugin-common';
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
    dnsPrefix: environment.spec?.gateway?.ingress?.external?.http?.host,
    createdAt: getCreatedAt(environment) ?? '',
    status: deriveStatus(environment),
  };
}
