import type {
  OpenChoreoComponents,
  OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  getName,
  getNamespace,
  getUid,
  getCreatedAt,
  getDisplayName,
  getDescription,
  deriveStatus,
} from './common';

type Project = OpenChoreoComponents['schemas']['Project'];
type ProjectResponse = OpenChoreoLegacyComponents['schemas']['ProjectResponse'];

export function transformProject(project: Project): ProjectResponse {
  return {
    uid: getUid(project) ?? '',
    name: getName(project) ?? '',
    namespaceName: getNamespace(project) ?? '',
    displayName: getDisplayName(project),
    description: getDescription(project),
    deploymentPipeline: project.spec?.deploymentPipelineRef,
    createdAt: getCreatedAt(project) ?? '',
    status: deriveStatus(project),
  };
}
