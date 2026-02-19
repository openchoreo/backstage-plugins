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

type DataPlane = OpenChoreoComponents['schemas']['DataPlane'];
type AgentConnectionStatus =
  OpenChoreoComponents['schemas']['AgentConnectionStatus'];
type DataPlaneResponse =
  OpenChoreoLegacyComponents['schemas']['DataPlaneResponse'];
type AgentConnectionStatusResponse =
  OpenChoreoLegacyComponents['schemas']['AgentConnectionStatusResponse'];

export function transformDataPlane(dataPlane: DataPlane): DataPlaneResponse {
  return {
    name: getName(dataPlane) ?? '',
    namespace: getNamespace(dataPlane) ?? '',
    displayName: getDisplayName(dataPlane),
    description: getDescription(dataPlane),
    imagePullSecretRefs: dataPlane.spec?.imagePullSecretRefs,
    secretStoreRef: dataPlane.spec?.secretStoreRef?.name,
    publicVirtualHost: dataPlane.spec?.gateway?.publicVirtualHost ?? '',
    namespaceVirtualHost:
      dataPlane.spec?.gateway?.organizationVirtualHost ?? '',
    publicHTTPPort: dataPlane.spec?.gateway?.publicHTTPPort ?? 80,
    publicHTTPSPort: dataPlane.spec?.gateway?.publicHTTPSPort ?? 443,
    // Legacy API had separate namespace ports; new API only has public + organization.
    // Map public ports to legacy namespace ports for backward compatibility.
    namespaceHTTPPort: dataPlane.spec?.gateway?.publicHTTPPort ?? 80,
    namespaceHTTPSPort: dataPlane.spec?.gateway?.publicHTTPSPort ?? 443,
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
