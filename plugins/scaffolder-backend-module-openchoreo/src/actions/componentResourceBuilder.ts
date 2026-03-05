import {
  ComponentResource,
  ComponentTrait,
  WorkloadEndpoint,
  WorkloadResource,
} from './componentResourceInterface';

/**
 * Deployment source type for component creation
 */
export type DeploymentSource =
  | 'build-from-source'
  | 'deploy-from-image'
  | 'external-ci';

/**
 * Parsed WORKFLOW_PARAMETERS annotation mapping.
 * Keys are fixed identifiers, values are dot-delimited paths into the workflow schema
 * (without the leading "parameters." prefix).
 *
 * Example annotation:
 *   repoUrl: parameters.repository.url
 *   branch: parameters.repository.revision.branch
 *   appPath: parameters.repository.appPath
 *   secretRef: parameters.repository.secretRef
 *   projectName: parameters.scope.projectName
 *   componentName: parameters.scope.componentName
 */
export interface WorkflowParameterMapping {
  repoUrl?: string;
  branch?: string;
  appPath?: string;
  secretRef?: string;
  projectName?: string;
  componentName?: string;
}

/**
 * Input data for building a component resource
 */
export interface ComponentResourceInput {
  // Section 1: Component Metadata
  componentName: string;
  displayName?: string;
  description?: string;
  namespaceName: string;
  projectName: string;

  // Section 2: Component Type Configuration
  componentType: string; // The component type name (e.g., "nodejs-service")
  componentTypeWorkloadType: string; // The workload type (e.g., "deployment")
  componentTypeKind?: 'ComponentType' | 'ClusterComponentType'; // Defaults to 'ComponentType'
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

  // Section 4: Annotation mapping for injecting git/scope fields into workflow parameters
  workflowParameterMapping?: WorkflowParameterMapping;

  // Section 5: Traits (optional)
  traits?: Array<{
    kind?: string;
    name: string;
    instanceName: string;
    config: Record<string, any>;
  }>;
}
/**
 * Builds a ComponentResource object from scaffolder form input
 *
 * This converts the form data into the structure required by the OpenChoreo API /apply endpoint
 */
export function buildComponentResource(
  input: ComponentResourceInput,
): ComponentResource {
  // Build the component resource
  const resource: ComponentResource = {
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'Component',
    metadata: {
      name: input.componentName,
      namespace: input.namespaceName,
      annotations: {},
    },
    spec: {
      owner: {
        projectName: input.projectName,
      },
      componentType: {
        kind: input.componentTypeKind || 'ComponentType',
        name: `${input.componentTypeWorkloadType}/${input.componentType}`,
      },
      parameters: input.ctdParameters || {},
      autoDeploy: input.autoDeploy ?? false,
    },
  };

  // Add display name annotation if provided
  if (input.displayName) {
    resource.metadata.annotations!['openchoreo.dev/display-name'] =
      input.displayName;
  }

  // Add description annotation if provided
  if (input.description) {
    resource.metadata.annotations!['openchoreo.dev/description'] =
      input.description;
  }

  // Add workflow configuration only for build-from-source deployment source
  // For external-ci and deploy-from-image, no workflow is attached to the component
  // External CI will create workloads via API, deploy-from-image creates a workload directly
  if (input.deploymentSource === 'build-from-source' && input.workflowName) {
    // Build workflow parameters from flat dot-notation to nested structure.
    // The RJSF form provides the developer-editable fields (e.g., docker.context).
    // These were filtered to exclude annotation-mapped fields (git source, scope).
    const workflowParams = input.workflowParameters
      ? convertFlatToNested(input.workflowParameters)
      : {};

    // The workflow parameters must match the workflow schema exactly.
    // The WORKFLOW_PARAMETERS annotation defines where git source fields and
    // implicit fields (projectName, componentName) live in the schema.
    // We inject them at the paths specified by the annotation.
    const mapping = input.workflowParameterMapping;
    if (mapping) {
      // Inject git source fields at annotation-defined paths
      if (mapping.repoUrl && input.repoUrl) {
        setNestedValue(
          workflowParams,
          stripParametersPrefix(mapping.repoUrl),
          input.repoUrl,
        );
      }
      if (mapping.branch) {
        setNestedValue(
          workflowParams,
          stripParametersPrefix(mapping.branch),
          input.branch || 'main',
        );
      }
      if (mapping.appPath) {
        setNestedValue(
          workflowParams,
          stripParametersPrefix(mapping.appPath),
          input.componentPath || '.',
        );
      }
      if (mapping.secretRef && input.gitSecretRef) {
        setNestedValue(
          workflowParams,
          stripParametersPrefix(mapping.secretRef),
          input.gitSecretRef,
        );
      }

      // Inject implicit fields
      if (mapping.projectName) {
        setNestedValue(
          workflowParams,
          stripParametersPrefix(mapping.projectName),
          input.projectName,
        );
      }
      if (mapping.componentName) {
        setNestedValue(
          workflowParams,
          stripParametersPrefix(mapping.componentName),
          input.componentName,
        );
      }
    }

    resource.spec.workflow = {
      name: input.workflowName,
      parameters: workflowParams,
    };
  }

  // Add traits (traits) if provided
  if (input.traits && input.traits.length > 0) {
    resource.spec.traits = input.traits.map(
      (trait): ComponentTrait => ({
        ...(trait.kind !== undefined && { kind: trait.kind }),
        name: trait.name,
        instanceName: trait.instanceName,
        // Convert flat dot-notation config to nested structure (same as workflow parameters)
        parameters: convertFlatToNested(trait.config),
      }),
    );
  }

  return resource;
}

/**
 * Input data for building a workload resource
 * Used for deploy-from-image flow and for any deployment source when workload data exists
 */
export interface WorkloadResourceInput {
  componentName: string;
  namespaceName: string;
  projectName: string;
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
 * Builds a WorkloadResource object for component deployment.
 *
 * Created for deploy-from-image flow (with container image) or for any deployment
 * source when workload data exists (endpoints, env vars, file mounts).
 * The Component controller will use this Workload to create deployments.
 */
export function buildWorkloadResource(
  input: WorkloadResourceInput,
): WorkloadResource {
  // Build container spec — only if there's an image, because the CRD requires
  // `image` (Required, MinLength=1) on Container. Without an image, containers
  // must be omitted entirely. Env vars and file mounts live inside a container,
  // so they can only be set when an image is provided.
  const hasImage = !!input.containerImage;

  const resource: WorkloadResource = {
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'Workload',
    metadata: {
      name: `${input.componentName}-workload`,
      namespace: input.namespaceName,
    },
    spec: {
      owner: {
        projectName: input.projectName,
        componentName: input.componentName,
      },
    },
  };

  if (hasImage) {
    const container: Record<string, any> = {
      image: input.containerImage,
    };

    // Add environment variables
    if (input.envVars && input.envVars.length > 0) {
      container.env = input.envVars;
    }

    // Add file mounts
    if (input.fileMounts && input.fileMounts.length > 0) {
      container.files = input.fileMounts;
    }

    resource.spec.container = container;
  }

  // Add endpoints from the new endpoints map
  if (input.endpoints && Object.keys(input.endpoints).length > 0) {
    resource.spec.endpoints = input.endpoints as any;
  }
  // Fallback: add endpoint if only port is provided (legacy deploy-from-image)
  else if (input.port) {
    resource.spec.endpoints = {
      http: {
        type: 'HTTP',
        port: input.port,
        visibility: ['external'],
      },
    };
  }

  return resource;
}

/**
 * Strip the "parameters." prefix from an annotation path.
 * e.g., "parameters.repository.url" → "repository.url"
 */
function stripParametersPrefix(path: string): string {
  return path.startsWith('parameters.')
    ? path.slice('parameters.'.length)
    : path;
}

/**
 * Set a value at a dot-delimited path in a nested object, creating
 * intermediate objects as needed.
 *
 * Example: setNestedValue(obj, "repository.revision.branch", "main")
 * → obj.repository.revision.branch = "main"
 */
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function setNestedValue(
  obj: Record<string, any>,
  path: string,
  value: any,
): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (DANGEROUS_KEYS.has(part)) return;
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = Object.create(null);
    }
    current = current[part];
  }

  const lastKey = parts[parts.length - 1];
  if (DANGEROUS_KEYS.has(lastKey)) return;
  current[lastKey] = value;
}

/**
 * Converts flat dot-notation object to nested structure
 *
 * Example:
 * Input: { "docker.context": "/app", "docker.filePath": "/Dockerfile", "repository.url": "https://..." }
 * Output: { docker: { context: "/app", filePath: "/Dockerfile" }, repository: { url: "https://..." } }
 */
function convertFlatToNested(flat: Record<string, any>): Record<string, any> {
  const nested: Record<string, any> = Object.create(null);

  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = nested;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (DANGEROUS_KEYS.has(part)) break;
      if (!current[part]) {
        current[part] = Object.create(null);
      }
      current = current[part];
    }

    const lastKey = parts[parts.length - 1];
    if (!DANGEROUS_KEYS.has(lastKey)) {
      current[lastKey] = value;
    }
  }

  return nested;
}
