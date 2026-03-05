import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { BuildPlaneResponse } from '@openchoreo/backstage-plugin-common';
import {
  getName,
  getNamespace,
  getCreatedAt,
  getDisplayName,
  getDescription,
  deriveStatus,
} from './common';

type BuildPlane = OpenChoreoComponents['schemas']['BuildPlane'];

export function transformBuildPlane(
  buildPlane: BuildPlane,
): BuildPlaneResponse {
  return {
    name: getName(buildPlane) ?? '',
    namespace: getNamespace(buildPlane) ?? '',
    displayName: getDisplayName(buildPlane),
    description: getDescription(buildPlane),
    observabilityPlaneRef: buildPlane.spec?.observabilityPlaneRef?.name,
    agentConnection: buildPlane.status?.agentConnection
      ? {
          connected: buildPlane.status.agentConnection.connected,
          connectedAgents: buildPlane.status.agentConnection.connectedAgents,
          lastConnectedTime:
            buildPlane.status.agentConnection.lastConnectedTime,
        }
      : undefined,
    createdAt: getCreatedAt(buildPlane) ?? '',
    status: deriveStatus(buildPlane),
  };
}
