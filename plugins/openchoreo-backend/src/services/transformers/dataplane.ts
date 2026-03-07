import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  DataPlaneResponse,
  AgentConnectionStatusResponse,
} from '@openchoreo/backstage-plugin-common';
import {
  getName,
  getNamespace,
  getCreatedAt,
  getDisplayName,
  getDescription,
  deriveStatus,
} from './common';

type DataPlane = OpenChoreoComponents['schemas']['DataPlane'];
type AgentConnectionStatus =
  OpenChoreoComponents['schemas']['AgentConnectionStatus'];

export function transformDataPlane(dataPlane: DataPlane): DataPlaneResponse {
  const ingress = dataPlane.spec?.gateway?.ingress;
  return {
    name: getName(dataPlane) ?? '',
    namespace: getNamespace(dataPlane) ?? '',
    displayName: getDisplayName(dataPlane),
    description: getDescription(dataPlane),
    secretStoreRef: dataPlane.spec?.secretStoreRef?.name,
    gateway: ingress
      ? {
          ingress: {
            external: ingress.external
              ? {
                  http: ingress.external.http
                    ? {
                        host: ingress.external.http.host,
                        port: ingress.external.http.port,
                      }
                    : undefined,
                  https: ingress.external.https
                    ? {
                        host: ingress.external.https.host,
                        port: ingress.external.https.port,
                      }
                    : undefined,
                }
              : undefined,
            internal: ingress.internal
              ? {
                  http: ingress.internal.http
                    ? {
                        host: ingress.internal.http.host,
                        port: ingress.internal.http.port,
                      }
                    : undefined,
                  https: ingress.internal.https
                    ? {
                        host: ingress.internal.https.host,
                        port: ingress.internal.https.port,
                      }
                    : undefined,
                }
              : undefined,
          },
        }
      : undefined,
    observabilityPlaneRef: dataPlane.spec?.observabilityPlaneRef?.name,
    agentConnection: dataPlane.status?.agentConnection
      ? transformAgentConnection(dataPlane.status.agentConnection)
      : undefined,
    createdAt: getCreatedAt(dataPlane) ?? '',
    status: deriveStatus(dataPlane),
  };
}

function transformAgentConnection(
  agent: AgentConnectionStatus,
): AgentConnectionStatusResponse {
  return {
    connected: agent.connected,
    connectedAgents: agent.connectedAgents,
    lastConnectedTime: agent.lastConnectedTime,
  };
}
