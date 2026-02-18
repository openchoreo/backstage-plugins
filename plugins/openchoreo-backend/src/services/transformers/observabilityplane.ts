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

type ObservabilityPlane =
  OpenChoreoComponents['schemas']['ObservabilityPlane'];
type ObservabilityPlaneResponse =
  OpenChoreoLegacyComponents['schemas']['ObservabilityPlaneResponse'];

export function transformObservabilityPlane(
  plane: ObservabilityPlane,
): ObservabilityPlaneResponse {
  return {
    name: getName(plane) ?? '',
    namespace: getNamespace(plane) ?? '',
    displayName: getDisplayName(plane),
    description: getDescription(plane),
    observerURL: plane.spec?.observerURL,
    agentConnection: plane.status?.agentConnection
      ? {
          connected: plane.status.agentConnection.connected,
          connectedAgents: plane.status.agentConnection.connectedAgents,
          lastConnectedTime: plane.status.agentConnection.lastConnectedTime,
        }
      : undefined,
    createdAt: getCreatedAt(plane) ?? '',
    status: deriveStatus(plane),
  };
}
