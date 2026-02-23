import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { ProjectResponse } from '@openchoreo/backstage-plugin-common';
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
