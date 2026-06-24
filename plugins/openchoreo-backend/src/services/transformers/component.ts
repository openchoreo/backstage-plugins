import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  ComponentResponse,
  ComponentWorkflowConfig,
  ReleaseBindingCondition,
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
import { deriveComponentReadiness } from './component-readiness';

type Component = OpenChoreoComponents['schemas']['Component'];

export function transformComponent(component: Component): ComponentResponse {
  const workflow = component.spec?.workflow;

  // componentType is now an object {kind, name} — extract the name string
  const componentTypeRef = component.spec?.componentType;
  const componentType =
    typeof componentTypeRef === 'string'
      ? componentTypeRef
      : componentTypeRef?.name ?? '';

  const latestRelease = component.status?.latestRelease;

  const rawConditions = component.status?.conditions;
  const conditions: ReleaseBindingCondition[] | undefined = Array.isArray(
    rawConditions,
  )
    ? rawConditions.map(
        (c: any): ReleaseBindingCondition => ({
          type: c.type,
          status: c.status,
          reason: c.reason,
          message: c.message,
          lastTransitionTime: c.lastTransitionTime,
          observedGeneration: c.observedGeneration,
        }),
      )
    : undefined;

  const readiness = deriveComponentReadiness(component);

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
    conditions,
    hasError: readiness.hasError,
    errorReason: readiness.reason,
    errorMessage: readiness.message,
    latestRelease: latestRelease
      ? {
          name: latestRelease.name,
          releaseHash: latestRelease.releaseHash,
        }
      : undefined,
    componentWorkflow: workflow
      ? transformComponentWorkflowConfig(workflow)
      : undefined,
    parameters: (component.spec as any)?.parameters,
  };
}

function transformComponentWorkflowConfig(
  workflow: NonNullable<Component['spec']>['workflow'],
): ComponentWorkflowConfig | undefined {
  if (!workflow) return undefined;
  return {
    kind: (workflow.kind as ComponentWorkflowConfig['kind']) ?? 'Workflow',
    name: workflow.name ?? '',
    parameters: workflow.parameters,
  };
}
