import { useEffect, useRef, useState } from 'react';
import { useApiHolder } from '@backstage/core-plugin-api';
import { isForbiddenError, isNotFoundError } from '../utils/errorUtils';
import { openChoreoClientApiRef } from '../api/OpenChoreoClientApi';

const WORKFLOW_PLANE_CHECK_TIMEOUT_MS = 15_000;
const DEFAULT_PLANE_NAME = 'default';

export type WorkflowPlaneAvailabilityStatus =
  | 'idle'
  | 'loading'
  | 'connected'
  | 'disconnected'
  | 'missing'
  | 'forbidden'
  | 'error'
  | 'unknown';

export interface WorkflowPlaneAvailability {
  status: WorkflowPlaneAvailabilityStatus;
  planeKind?: 'WorkflowPlane' | 'ClusterWorkflowPlane';
  planeName?: string;
  error?: string;
}

export interface WorkflowPlaneCheckInput {
  namespaceName?: string;
  workflowName?: string;
  workflowKind?: 'Workflow' | 'ClusterWorkflow';
}

interface ResourceDefinitionClient {
  getResourceDefinition(
    kind:
      | 'workflows'
      | 'clusterworkflows'
      | 'workflowplanes'
      | 'clusterworkflowplanes',
    namespaceName: string,
    resourceName: string,
  ): Promise<Record<string, unknown>>;
}

interface WorkflowPlaneRef {
  kind?: string;
  name?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function failureState(error: unknown): WorkflowPlaneAvailability {
  const message =
    error instanceof Error ? error.message : 'An unknown error occurred';
  return {
    status: isForbiddenError(error) ? 'forbidden' : 'error',
    error: message,
  };
}

async function checkPlane(
  client: ResourceDefinitionClient,
  kind: 'WorkflowPlane' | 'ClusterWorkflowPlane',
  name: string,
  namespaceName: string,
): Promise<WorkflowPlaneAvailability> {
  try {
    const definition = await client.getResourceDefinition(
      kind === 'WorkflowPlane' ? 'workflowplanes' : 'clusterworkflowplanes',
      kind === 'WorkflowPlane' ? namespaceName : '',
      name,
    );
    const status = isRecord(definition.status) ? definition.status : undefined;
    const agentConnection =
      status && isRecord(status.agentConnection)
        ? status.agentConnection
        : undefined;

    let connectionStatus: WorkflowPlaneAvailability['status'] = 'unknown';

    if (agentConnection?.connected === true) {
      connectionStatus = 'connected';
    } else if (agentConnection?.connected === false) {
      connectionStatus = 'disconnected';
    }

    return {
      status: connectionStatus,
      planeKind: kind,
      planeName: name,
    };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { status: 'missing', planeKind: kind, planeName: name };
    }
    return failureState(error);
  }
}

/**
 * Resolves the plane used by a workflow and checks its agent connection.
 * A nil namespaced Workflow reference follows the controller's legacy
 * namespace-default-first fallback; a nil ClusterWorkflow reference is
 * cluster-scoped only.
 */
export async function checkWorkflowPlaneAvailability(
  client: ResourceDefinitionClient,
  input: WorkflowPlaneCheckInput,
): Promise<WorkflowPlaneAvailability> {
  const { workflowName, namespaceName = '', workflowKind = 'Workflow' } = input;

  if (!workflowName) {
    return { status: 'idle' };
  }
  if (workflowKind === 'Workflow' && !namespaceName) {
    return {
      status: 'error',
      error: 'A namespace is required to check this workflow plane.',
    };
  }

  try {
    const workflow = await client.getResourceDefinition(
      workflowKind === 'ClusterWorkflow' ? 'clusterworkflows' : 'workflows',
      workflowKind === 'ClusterWorkflow' ? '' : namespaceName,
      workflowName,
    );
    const spec = isRecord(workflow.spec) ? workflow.spec : undefined;
    const ref = spec?.workflowPlaneRef as WorkflowPlaneRef | undefined;

    if (ref) {
      if (!ref.name) {
        return {
          status: 'error',
          error: 'The workflow has an incomplete workflowPlaneRef.',
        };
      }
      if (ref.kind !== 'WorkflowPlane' && ref.kind !== 'ClusterWorkflowPlane') {
        return {
          status: 'error',
          error: `The workflow references an unsupported plane kind: ${String(
            ref.kind,
          )}.`,
        };
      }
      if (
        workflowKind === 'ClusterWorkflow' &&
        ref.kind !== 'ClusterWorkflowPlane'
      ) {
        return {
          status: 'error',
          error: 'A ClusterWorkflow must reference a ClusterWorkflowPlane.',
        };
      }
      return checkPlane(client, ref.kind, ref.name, namespaceName);
    }

    if (workflowKind === 'ClusterWorkflow') {
      return checkPlane(
        client,
        'ClusterWorkflowPlane',
        DEFAULT_PLANE_NAME,
        namespaceName,
      );
    }

    const namespaceDefault = await checkPlane(
      client,
      'WorkflowPlane',
      DEFAULT_PLANE_NAME,
      namespaceName,
    );
    if (namespaceDefault.status !== 'missing') {
      return namespaceDefault;
    }
    return checkPlane(
      client,
      'ClusterWorkflowPlane',
      DEFAULT_PLANE_NAME,
      namespaceName,
    );
  } catch (error) {
    return failureState(error);
  }
}

export function isWorkflowPlaneUnavailable(
  status: WorkflowPlaneAvailabilityStatus,
): boolean {
  return status === 'missing' || status === 'disconnected';
}

export function getWorkflowPlaneAvailabilityMessage(
  availability: WorkflowPlaneAvailability,
): string | undefined {
  const plane =
    availability.planeKind && availability.planeName
      ? `${availability.planeKind} "${availability.planeName}"`
      : 'The workflow plane';

  switch (availability.status) {
    case 'loading':
      return 'Checking workflow plane availability...';
    case 'missing':
      return `${plane} was not found. Built-in CI builds cannot run until the plane is installed.`;
    case 'disconnected':
      return `${plane} is disconnected. Built-in CI builds cannot run until its agent reconnects.`;
    case 'forbidden':
      return 'You do not have permission to check the workflow plane. Its availability is unknown.';
    case 'error':
      return `Could not check workflow plane availability: ${
        availability.error || 'An unexpected error occurred.'
      }`;
    case 'unknown':
      return `${plane} does not report its agent connection status, so build availability could not be confirmed.`;
    default:
      return undefined;
  }
}

export function useWorkflowPlaneAvailability(
  input: WorkflowPlaneCheckInput,
): WorkflowPlaneAvailability {
  const client = useApiHolder().get(openChoreoClientApiRef);
  const [result, setResult] = useState<{
    key: string;
    availability: WorkflowPlaneAvailability;
  } | null>(null);
  const resultRef = useRef(result);

  const workflowKind = input.workflowKind ?? 'Workflow';
  const workflowName = input.workflowName;
  const namespaceName = input.namespaceName ?? '';
  const key = `${workflowKind}:${namespaceName}:${workflowName ?? ''}`;

  useEffect(() => {
    if (!workflowName) {
      resultRef.current = null;
      setResult(null);
      return undefined;
    }

    if (!client) {
      const nextResult = {
        key,
        availability: {
          status: 'error' as const,
          error: 'The OpenChoreo client API is not registered.',
        },
      };
      resultRef.current = nextResult;
      setResult(nextResult);
      return undefined;
    }

    let active = true;
    let inFlight = false;
    let refreshPending = false;
    let requestId = 0;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => {
      if (!active) return;

      if (inFlight) {
        refreshPending = true;
        return;
      }

      inFlight = true;
      refreshPending = false;
      const currentRequestId = ++requestId;
      let requestTimeout: ReturnType<typeof setTimeout> | undefined;

      if (resultRef.current?.key !== key) {
        const loadingResult = {
          key,
          availability: { status: 'loading' as const },
        };
        resultRef.current = loadingResult;
        setResult(loadingResult);
      }

      const check = checkWorkflowPlaneAvailability(client, {
        workflowName,
        namespaceName,
        workflowKind,
      });
      const timeoutCheck = new Promise<WorkflowPlaneAvailability>(
        (_, reject) => {
          requestTimeout = setTimeout(
            () => reject(new Error('The workflow plane check timed out.')),
            WORKFLOW_PLANE_CHECK_TIMEOUT_MS,
          );
          timeout = requestTimeout;
        },
      );

      Promise.race([check, timeoutCheck])
        .then(availability => {
          if (active && currentRequestId === requestId) {
            const nextResult = { key, availability };
            resultRef.current = nextResult;
            setResult(nextResult);
          }
        })
        .catch(error => {
          if (active && currentRequestId === requestId) {
            const nextResult = {
              key,
              availability: {
                status: 'error' as const,
                error:
                  error instanceof Error
                    ? error.message
                    : 'An unknown error occurred',
              },
            };
            resultRef.current = nextResult;
            setResult(nextResult);
          }
        })
        .finally(() => {
          if (requestTimeout) clearTimeout(requestTimeout);
          if (timeout === requestTimeout) timeout = undefined;
        });

      const releaseRequest = () => {
        if (!active || currentRequestId !== requestId) return;
        inFlight = false;
        if (refreshPending) {
          refreshPending = false;
          refresh();
        }
      };
      check.then(releaseRequest, releaseRequest);
    };

    refresh();
    window.addEventListener('focus', refresh);

    return () => {
      active = false;
      requestId += 1;
      if (timeout) clearTimeout(timeout);
      window.removeEventListener('focus', refresh);
    };
  }, [client, key, namespaceName, workflowKind, workflowName]);

  if (!workflowName) return { status: 'idle' };
  return result?.key === key ? result.availability : { status: 'loading' };
}
