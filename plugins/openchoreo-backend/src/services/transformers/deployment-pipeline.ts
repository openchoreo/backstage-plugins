import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { DeploymentPipelineResponse } from '@openchoreo/backstage-plugin-common';
import {
  getName,
  getNamespace,
  getCreatedAt,
  getDisplayName,
  getDescription,
  deriveStatus,
} from './common';

type DeploymentPipeline = OpenChoreoComponents['schemas']['DeploymentPipeline'];

export function transformDeploymentPipeline(
  pipeline: DeploymentPipeline,
): DeploymentPipelineResponse {
  return {
    name: getName(pipeline) ?? '',
    displayName: getDisplayName(pipeline),
    description: getDescription(pipeline),
    namespaceName: getNamespace(pipeline) ?? '',
    createdAt: getCreatedAt(pipeline) ?? '',
    status: deriveStatus(pipeline),
    promotionPaths: pipeline.spec?.promotionPaths,
  };
}
