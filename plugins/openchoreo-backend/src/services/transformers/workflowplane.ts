import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { WorkflowPlaneResponse } from '@openchoreo/backstage-plugin-common';
import {
  getName,
  getNamespace,
  getCreatedAt,
  getDisplayName,
  getDescription,
  deriveStatus,
} from './common';

type WorkflowPlane = OpenChoreoComponents['schemas']['WorkflowPlane'];

export function transformWorkflowPlane(
  workflowPlane: WorkflowPlane,
): WorkflowPlaneResponse {
  return {
    name: getName(workflowPlane) ?? '',
    namespace: getNamespace(workflowPlane) ?? '',
    displayName: getDisplayName(workflowPlane),
    description: getDescription(workflowPlane),
    observabilityPlaneRef: workflowPlane.spec?.observabilityPlaneRef?.name,
    agentConnection: workflowPlane.status?.agentConnection
      ? {
          connected: workflowPlane.status.agentConnection.connected,
          connectedAgents: workflowPlane.status.agentConnection.connectedAgents,
          lastConnectedTime:
            workflowPlane.status.agentConnection.lastConnectedTime,
        }
      : undefined,
    createdAt: getCreatedAt(workflowPlane) ?? '',
    status: deriveStatus(workflowPlane),
  };
}
