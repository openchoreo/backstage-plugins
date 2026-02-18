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

type Component = OpenChoreoComponents['schemas']['Component'];
type ComponentResponse =
  OpenChoreoLegacyComponents['schemas']['ComponentResponse'];
type ComponentWorkflow =
  OpenChoreoLegacyComponents['schemas']['ComponentWorkflow'];

export function transformComponent(component: Component): ComponentResponse {
  const workflow = component.spec?.workflow;

  return {
    uid: getUid(component) ?? '',
    name: getName(component) ?? '',
    displayName: getDisplayName(component),
    description: getDescription(component),
    type: component.spec?.type ?? component.spec?.componentType ?? '',
    projectName: component.spec?.owner?.projectName ?? '',
    namespaceName: getNamespace(component) ?? '',
    createdAt: getCreatedAt(component) ?? '',
    status: deriveStatus(component),
    autoDeploy: component.spec?.autoDeploy,
    componentWorkflow: workflow
      ? transformComponentWorkflow(workflow)
      : undefined,
  };
}

function transformComponentWorkflow(
  workflow: NonNullable<Component['spec']>['workflow'],
): ComponentWorkflow | undefined {
  if (!workflow) return undefined;
  return {
    name: workflow.name,
    systemParameters: {
      repository: {
        url: workflow.systemParameters.repository.url,
        appPath: workflow.systemParameters.repository.appPath,
        revision: {
          branch: workflow.systemParameters.repository.revision.branch,
          commit: workflow.systemParameters.repository.revision.commit,
        },
      },
    },
    parameters: workflow.parameters,
  };
}
