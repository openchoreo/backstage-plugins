import {
  ComponentResource,
  ComponentTrait,
  WorkloadEndpoint,
  WorkloadResource,
} from './componentResourceInterface';
import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

type CreateComponentRequest =
  OpenChoreoComponents['schemas']['CreateComponentRequest'];

/**
 * Deployment source type for component creation
 */
export type DeploymentSource =
  | 'build-from-source'
  | 'deploy-from-image'
  | 'external-ci';

/**
 * Input data for building a component resource
 */
export interface ComponentResourceInput {
  // Section 1: Component Metadata
  componentName: string;
  displayName?: string;
  description?: string;

  // Section 2: Component Type Configuration
  componentType: string; // The component type name (e.g., "nodejs-service")
  componentTypeWorkloadType: string; // The workload type (e.g., "deployment")
  ctdParameters?: Record<string, any>; // Parameters from component type schema

  // Section 3: Deployment Source & CI/CD Setup
  deploymentSource?: DeploymentSource;
  autoDeploy?: boolean;
  repoUrl?: string;
  branch?: string;
  componentPath?: string;
  workflowName?: string;
  workflowParameters?: Record<string, any>;
  containerImage?: string; // For deploy-from-image
  gitSecretRef?: string; // Secret reference for private repository credentials

  // Section 4: Traits (optional)
  traits?: Array<{
    name: string;
    instanceName: string;
    config: Record<string, any>;
  }>;
}

/**
 * Builds a CreateComponentRequest body from scaffolder form input
 *
 * This converts the form data into the structure required by the
 * POST /namespaces/{ns}/projects/{proj}/components REST endpoint
 */
export function buildComponentResource(
  input: ComponentResourceInput,
): CreateComponentRequest {
  const request: CreateComponentRequest = {
    name: input.componentName,
    displayName: input.displayName,
    description: input.description,
    componentType: `${input.componentTypeWorkloadType}/${input.componentType}`,
    autoDeploy: input.autoDeploy ?? false,
    parameters: input.ctdParameters || {},
  };

  // Add workflow configuration only for build-from-source deployment source
  // For external-ci and deploy-from-image, no workflow is attached to the component
  if (
    input.deploymentSource === 'build-from-source' &&
    input.workflowName &&
    input.workflowParameters
  ) {
    // Build workflow schema from flat workflow parameters
    // Workflow parameters come in dot-notation (e.g., "docker.context", "docker.filePath")
    // Need to convert to nested structure
    const workflowParams = convertFlatToNested(input.workflowParameters);

    if (input.repoUrl) {
      const repository: Record<string, any> = {
        url: input.repoUrl,
        revision: {
          branch: input.branch || 'main',
        },
        appPath: input.componentPath || '.',
      };
      if (input.gitSecretRef) {
        repository.secretRef = input.gitSecretRef;
      }

      request.workflow = {
        name: input.workflowName,
        systemParameters: { repository } as any,
        parameters: workflowParams,
      };
    } else {
      request.workflow = {
        name: input.workflowName,
        // systemParameters is required by the type but may not always be present
        // (e.g., if no repo URL is given)
        systemParameters: {
          repository: { url: '', revision: { branch: 'main' }, appPath: '.' },
        },
        parameters: workflowParams,
      };
    }
  }

  // Add traits if provided
  if (input.traits && input.traits.length > 0) {
    request.traits = input.traits.map(trait => ({
      name: trait.name,
      instanceName: trait.instanceName,
      // Convert flat dot-notation config to nested structure (same as workflow parameters)
      parameters: convertFlatToNested(trait.config),
    }));
  }

  return request;
}

/**
 * Input data for building a workload request body
 * Used for deploy-from-image flow and for any deployment source when workload data exists
 */
export interface WorkloadResourceInput {
  containerImage?: string;
  port?: number;
  endpoints?: Record<string, WorkloadEndpoint>;
  envVars?: Array<{
    key: string;
    value?: string;
    valueFrom?: { secretRef?: { name: string; key: string } };
  }>;
  fileMounts?: Array<{
    key: string;
    mountPath: string;
    value?: string;
    valueFrom?: { secretRef?: { name: string; key: string } };
  }>;
}

/**
 * Workload request body for the createWorkload REST endpoint.
 */
export interface WorkloadBody {
  containers: Record<string, Record<string, any>>;
  endpoints?: Record<string, { type: string; port: number; visibility: 'project' | 'namespace' | 'internal' | 'external'; }>;
}

/**
 * Builds a workload request body for the createWorkload REST endpoint.
 *
 * Created for deploy-from-image flow (with container image) or for any deployment
 * source when workload data exists (endpoints, env vars, file mounts).
 */
export function buildWorkloadResource(
  input: WorkloadResourceInput,
): WorkloadBody {
  // Build container spec — only if there's an image, because the API requires
  // `image` on Container. Without an image, containers must be omitted entirely.
  // Env vars and file mounts live inside a container, so they can only be set
  // when an image is provided.
  const hasImage = !!input.containerImage;

  const body: WorkloadBody = {
    containers: {},
  };

  if (hasImage) {
    const mainContainer: Record<string, any> = {
      image: input.containerImage,
    };

    // Add environment variables
    if (input.envVars && input.envVars.length > 0) {
      mainContainer.env = input.envVars;
    }

    // Add file mounts
    if (input.fileMounts && input.fileMounts.length > 0) {
      mainContainer.files = input.fileMounts;
    }

    body.containers = { main: mainContainer };
  }

  // Add endpoints from the new endpoints map
  if (input.endpoints && Object.keys(input.endpoints).length > 0) {
    body.endpoints = input.endpoints;
  }
  // Fallback: add endpoint if only port is provided (legacy deploy-from-image)
  else if (input.port) {
    body.endpoints = {
      http: {
        type: 'HTTP',
        port: input.port,
        visibility: 'external',
      },
    };
  }

  return body;
}

/**
 * Converts flat dot-notation object to nested structure
 *
 * Example:
 * Input: { "docker.context": "/app", "docker.filePath": "/Dockerfile", "repository.url": "https://..." }
 * Output: { docker: { context: "/app", filePath: "/Dockerfile" }, repository: { url: "https://..." } }
 */
function convertFlatToNested(flat: Record<string, any>): Record<string, any> {
  const nested: Record<string, any> = {};

  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = nested;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  return nested;
}
