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
  return {
    name: getName(dataPlane) ?? '',
    namespace: getNamespace(dataPlane) ?? '',
    displayName: getDisplayName(dataPlane),
    description: getDescription(dataPlane),
    imagePullSecretRefs: dataPlane.spec?.imagePullSecretRefs,
    secretStoreRef: dataPlane.spec?.secretStoreRef?.name,
    publicVirtualHost:
      dataPlane.spec?.gateway?.ingress?.external?.http?.host ?? '',
    namespaceVirtualHost:
      dataPlane.spec?.gateway?.ingress?.internal?.http?.host ?? '',
    publicHTTPPort:
      dataPlane.spec?.gateway?.ingress?.external?.http?.port ?? 80,
    publicHTTPSPort:
      dataPlane.spec?.gateway?.ingress?.external?.https?.port ?? 443,
    namespaceHTTPPort:
      dataPlane.spec?.gateway?.ingress?.internal?.http?.port ?? 80,
    namespaceHTTPSPort:
      dataPlane.spec?.gateway?.ingress?.internal?.https?.port ?? 443,
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
