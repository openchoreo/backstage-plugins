import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  ComponentResponse,
  ComponentWorkflow,
} from '@openchoreo/backstage-plugin-common';
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

export function transformComponent(component: Component): ComponentResponse {
  const workflow = component.spec?.workflow;

  // componentType is now an object {kind, name} — extract the name string
  const componentTypeRef = component.spec?.componentType;
  const componentType =
    typeof componentTypeRef === 'string'
      ? componentTypeRef
      : componentTypeRef?.name ?? '';

  return {
    uid: getUid(component) ?? '',
    name: getName(component) ?? '',
    displayName: getDisplayName(component),
    description: getDescription(component),
    type: componentType,
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
    name: workflow.name ?? '',
    systemParameters: {
      repository: {
        url: workflow.systemParameters?.repository?.url ?? '',
        appPath: workflow.systemParameters?.repository?.appPath ?? '',
        revision: {
          branch: workflow.systemParameters?.repository?.revision?.branch ?? '',
          commit: workflow.systemParameters?.repository?.revision?.commit,
        },
      },
    },
    parameters: workflow.parameters,
  };
}
