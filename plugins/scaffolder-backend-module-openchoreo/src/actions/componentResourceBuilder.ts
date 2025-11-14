import { ComponentResource, ComponentTrait } from '../../../openchoreo-api/src/models/ModelsComponentResource.model';

/**
 * Input data for building a component resource
 */
export interface ComponentResourceInput {
  // Section 1: Component Metadata
  componentName: string;
  displayName?: string;
  description?: string;
  organizationName: string;
  projectName: string;

  // Section 2: Component Type Configuration
  componentType: string; // The component type name (e.g., "nodejs-service")
  componentTypeWorkloadType: string; // The workload type (e.g., "deployment")
  ctdParameters?: Record<string, any>; // Parameters from component type schema

  // Section 3: CI Setup (optional - only if useBuiltInCI is true)
  useBuiltInCI?: boolean;
  repoUrl?: string;
  branch?: string;
  componentPath?: string;
  workflowName?: string;
  workflowParameters?: Record<string, any>;

  // Section 4: Addons (optional)
  addons?: Array<{
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
export function buildComponentResource(input: ComponentResourceInput): ComponentResource {
  // Build the component resource
  const resource: ComponentResource = {
    apiVersion: 'openchoreo.dev/v1alpha1',
    kind: 'Component',
    metadata: {
      name: input.componentName,
      namespace: input.organizationName,
      annotations: {},
    },
    spec: {
      owner: {
        projectName: input.projectName,
      },
      componentType: `${input.componentTypeWorkloadType}/${input.componentType}`,
      parameters: input.ctdParameters || {},
    },
  };

  // Add display name annotation if provided
  if (input.displayName) {
    resource.metadata.annotations!['openchoreo.dev/display-name'] = input.displayName;
  }

  // Add description annotation if provided
  if (input.description) {
    resource.metadata.annotations!['openchoreo.dev/description'] = input.description;
  }

  // Add workflow configuration if Choreo CI is enabled
  if (input.useBuiltInCI && input.workflowName && input.workflowParameters) {
    // Build workflow schema from flat workflow parameters
    // Workflow parameters come in dot-notation (e.g., "docker.context", "repository.url")
    // Need to convert to nested structure
    const workflowSchema = convertFlatToNested(input.workflowParameters);

    resource.spec.workflow = {
      name: input.workflowName,
      schema: workflowSchema,
    };
  }

  // Add traits (addons) if provided
  if (input.addons && input.addons.length > 0) {
    resource.spec.traits = input.addons.map((addon): ComponentTrait => ({
      name: addon.name,
      instanceName: addon.instanceName,
      config: addon.config,
    }));
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
