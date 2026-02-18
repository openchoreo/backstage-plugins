import type {
  OpenChoreoComponents,
  OpenChoreoLegacyComponents,
} from '@openchoreo/openchoreo-client-node';
import { getName, getNamespace, getUid, getCreatedAt, deriveStatus } from './common';

type ComponentWorkflowRun =
  OpenChoreoComponents['schemas']['ComponentWorkflowRun'];
type ComponentWorkflowRunResponse =
  OpenChoreoLegacyComponents['schemas']['ComponentWorkflowRunResponse'];

export function transformComponentWorkflowRun(
  run: ComponentWorkflowRun,
): ComponentWorkflowRunResponse {
  const workflow = run.spec?.workflow;

  return {
    name: getName(run) ?? '',
    uuid: getUid(run) ?? '',
    componentName: run.spec?.owner?.componentName ?? '',
    projectName: run.spec?.owner?.projectName ?? '',
    namespaceName: getNamespace(run) ?? '',
    commit:
      workflow?.systemParameters?.repository?.revision?.commit,
    status: deriveStatus(run),
    createdAt: getCreatedAt(run) ?? '',
    image: run.status?.imageStatus?.image,
    workflow: workflow
      ? {
          name: workflow.name,
          systemParameters: {
            repository: {
              url: workflow.systemParameters.repository.url,
              appPath: workflow.systemParameters.repository.appPath,
              revision: {
                branch:
                  workflow.systemParameters.repository.revision.branch,
                commit:
                  workflow.systemParameters.repository.revision.commit,
              },
            },
          },
          parameters: workflow.parameters,
        }
      : undefined,
  };
}
