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

type DeploymentPipeline = OpenChoreoComponents['schemas']['DeploymentPipeline'];
type DeploymentPipelineResponse =
  OpenChoreoLegacyComponents['schemas']['DeploymentPipelineResponse'];

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
