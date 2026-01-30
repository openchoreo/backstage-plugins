import {
  ComponentResource,
  ComponentTrait,
  WorkloadResource,
} from './componentResourceInterface';

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
  ctdParameters?: Record<string, any>; // Parameters from component type schema

  // Section 3: CI/CD Setup
  useBuiltInCI?: boolean;
  autoDeploy?: boolean;
  repoUrl?: string;
  branch?: string;
  componentPath?: string;
  workflowName?: string;
  workflowParameters?: Record<string, any>;

  // Section 4: Traits (optional)
  traits?: Array<{
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
      componentType: `${input.componentTypeWorkloadType}/${input.componentType}`,
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

  // Add workflow configuration if workflow name and parameters are provided
  // This applies when building from source (useBuiltInCI is deprecated, we check for workflow data instead)
  if (input.workflowName && input.workflowParameters) {
    // Build workflow schema from flat workflow parameters
    // Workflow parameters come in dot-notation (e.g., "docker.context", "repository.url")
    // Need to convert to nested structure
    const workflowSchema = convertFlatToNested(input.workflowParameters);

    resource.spec.workflow = {
      name: input.workflowName,
      ...workflowSchema, // Spread parameters and systemParameters directly
    };
  }

  // Add traits (traits) if provided
  if (input.traits && input.traits.length > 0) {
    resource.spec.traits = input.traits.map(
      (trait): ComponentTrait => ({
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
 * Input data for building a workload resource (for deploy-from-image flow)
 */
export interface WorkloadResourceInput {
  componentName: string;
  namespaceName: string;
  projectName: string;
  containerImage: string;
  port?: number;
}

/**
 * Builds a WorkloadResource object for the deploy-from-image flow
 *
 * When a user chooses to deploy from a pre-built image instead of building from source,
 * we create a Workload CR that references the component and contains the image reference.
 * The Component controller will then use this Workload to create deployments.
 */
export function buildWorkloadResource(
  input: WorkloadResourceInput,
): WorkloadResource {
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
      containers: {
        main: {
          image: input.containerImage,
        },
      },
    },
  };

  // Add endpoint if port is provided
  if (input.port) {
    resource.spec.endpoints = {
      http: {
        type: 'HTTP',
        port: input.port,
      },
    };
  }

  return resource;
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
