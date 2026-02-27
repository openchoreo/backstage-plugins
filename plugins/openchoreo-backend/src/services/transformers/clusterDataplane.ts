import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  ClusterDataPlaneResponse,
  AgentConnectionStatusResponse,
} from '@openchoreo/backstage-plugin-common';
import {
  getName,
  getCreatedAt,
  getDisplayName,
  getDescription,
  deriveStatus,
} from './common';

type ClusterDataPlane = OpenChoreoComponents['schemas']['ClusterDataPlane'];
type AgentConnectionStatus =
  OpenChoreoComponents['schemas']['AgentConnectionStatus'];

export function transformClusterDataPlane(
  dataPlane: ClusterDataPlane,
): ClusterDataPlaneResponse {
  return {
    name: getName(dataPlane) ?? '',
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
