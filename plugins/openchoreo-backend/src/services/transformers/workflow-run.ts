import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type { ComponentWorkflowRunResponse } from '@openchoreo/backstage-plugin-common';

type ComponentWorkflowRun =
  OpenChoreoComponents['schemas']['ComponentWorkflowRun'];

/**
 * Transforms a new-API ComponentWorkflowRun (flat response) into the legacy
 * ComponentWorkflowRunResponse shape. Both types are structurally identical,
 * so this is essentially a pass-through with default values.
 */
export function transformComponentWorkflowRun(
  run: ComponentWorkflowRun,
): ComponentWorkflowRunResponse {
  return {
    name: run.name,
    uuid: run.uuid ?? '',
    componentName: run.componentName,
    projectName: run.projectName,
    namespaceName: run.namespaceName,
    commit: run.commit,
    status: run.status,
    createdAt: run.createdAt,
    image: run.image,
    workflow: run.workflow
      ? {
          name: run.workflow.name ?? '',
          systemParameters: {
            repository: {
              url: run.workflow.systemParameters?.repository?.url ?? '',
              appPath: run.workflow.systemParameters?.repository?.appPath ?? '',
              revision: {
                branch:
                  run.workflow.systemParameters?.repository?.revision?.branch ??
                  '',
                commit:
                  run.workflow.systemParameters?.repository?.revision?.commit,
              },
            },
          },
          parameters: run.workflow.parameters,
        }
      : undefined,
  };
}
