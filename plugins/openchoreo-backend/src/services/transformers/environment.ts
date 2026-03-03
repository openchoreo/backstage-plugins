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
  const ingress = environment.spec?.gateway?.ingress;
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
    dnsPrefix: ingress?.external?.http?.host,
    gateway: ingress
      ? {
          ingress: {
            external: ingress.external
              ? {
                  http: ingress.external.http
                    ? { host: ingress.external.http.host, port: ingress.external.http.port }
                    : undefined,
                  https: ingress.external.https
                    ? { port: ingress.external.https.port }
                    : undefined,
                }
              : undefined,
            internal: ingress.internal
              ? {
                  http: ingress.internal.http
                    ? { host: ingress.internal.http.host, port: ingress.internal.http.port }
                    : undefined,
                  https: ingress.internal.https
                    ? { port: ingress.internal.https.port }
                    : undefined,
                }
              : undefined,
          },
        }
      : undefined,
    createdAt: getCreatedAt(environment) ?? '',
    status: deriveStatus(environment),
  };
}
