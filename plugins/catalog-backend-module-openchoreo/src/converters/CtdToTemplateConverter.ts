import { Entity } from '@backstage/catalog-model';
import { JSONSchema7 } from 'json-schema';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';

/**
 * Namespace used for cluster-scoped resources such as ClusterWorkflows
 * and ClusterComponentType templates.
 */
const CLUSTER_WORKFLOW_NAMESPACE = 'openchoreo-cluster';

/**
 * ComponentType CRD structure as returned by the Kubernetes API.
 * This represents the full CRD object with metadata and spec.
 */
export interface ComponentType {
  metadata: {
    name: string;
    displayName?: string;
    description?: string;
    workloadType: string;
    allowedWorkflows?: Array<string | { kind?: string; name: string }>;
    allowedTraits?: Array<{ kind?: string; name: string }>;
    tags?: string[];
    createdAt?: string;
  };
  spec: {
    inputParametersSchema?: JSONSchema7;
  };
}

/**
 * Configuration for the Component Type to Template converter
 */
export interface CtdConverterConfig {
  /**
   * Default owner for generated templates (required by Backstage Template kind schema)
   */
  defaultOwner?: string;
}

/**
 * Converts OpenChoreo Component Types to Backstage Template entities
 */
export class CtdToTemplateConverter {
  private readonly defaultOwner: string;

  constructor(config?: CtdConverterConfig) {
    this.defaultOwner = config?.defaultOwner || 'guests';
  }

  /**
   * Convert a Component Type to a Backstage Template entity
   */
  convertCtdToTemplateEntity(
    componentType: ComponentType,
    namespaceName: string,
  ): Entity {
    const templateName = this.generateTemplateName(componentType.metadata.name);
    const title =
      componentType.metadata.displayName ||
      this.formatTitle(componentType.metadata.name);
    const description =
      componentType.metadata.description || `Create a ${title} component`;

    // Build the template entity
    const templateEntity: Entity = {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: templateName,
        namespace: namespaceName,
        title,
        description,
        // tags,
        annotations: {
          [CHOREO_ANNOTATIONS.CTD_NAME]: componentType.metadata.name,
          [CHOREO_ANNOTATIONS.CTD_GENERATED]: 'true',
          [CHOREO_ANNOTATIONS.WORKLOAD_TYPE]:
            componentType.metadata.workloadType,
        },
      },
      spec: {
        owner: this.defaultOwner,
        type: 'Component', // All component type templates use 'Component Type' type
        // Enable user token injection for user-based authorization at OpenChoreo API
        EXPERIMENTAL_formDecorators: [{ id: 'openchoreo:inject-user-token' }],
        parameters: this.generateParameters(componentType, namespaceName),
        steps: this.generateSteps(componentType),
        output: {
          links: [
            {
              title: 'View Component',
              icon: 'kind:component',
              entityRef:
                "component:${{ steps['create-component'].output.namespaceName }}/${{ steps['create-component'].output.componentName }}",
            },
          ],
        },
      },
    };

    // Add displayName annotation if provided
    if (componentType.metadata.displayName) {
      templateEntity.metadata.annotations![
        CHOREO_ANNOTATIONS.CTD_DISPLAY_NAME
      ] = componentType.metadata.displayName;
    }

    return templateEntity;
  }

  /**
   * Generate template name from component type name
   * Example: "web-service" -> "template-web-service"
   */
  private generateTemplateName(componentTypeName: string): string {
    return `template-${componentTypeName}`;
  }

  /**
   * Format component type name to human-readable title
   * Example: "web-service" -> "Web Service"
   */
  private formatTitle(name: string): string {
    return name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Generate template parameters from component type schema
   * Includes standard fields + component type-specific fields
   *
   * Structure: 3 sections
   *   1. Component Metadata (project, name, description)
   *   2. Build & Deploy (deployment source + CI/CD)
   *   3. Workload Details (CTD params + endpoints + env vars + file mounts + traits)
   */
  private generateParameters(
    componentType: ComponentType,
    namespaceName: string,
    ctdKind: 'ComponentType' | 'ClusterComponentType' = 'ComponentType',
  ): any[] {
    const parameters: any[] = [];

    const metadataSection = {
      title: 'Component Metadata',
      required: ['project_namespace', 'component_name'],
      properties: {
        project_namespace: {
          title: 'Project & Namespace',
          type: 'object',
          'ui:field': 'ProjectNamespaceField',
          'ui:options': {
            defaultNamespace: namespaceName,
          },
          properties: {
            project_name: { type: 'string' },
            namespace_name: { type: 'string' },
          },
          required: ['project_name', 'namespace_name'],
        },
        component_name: {
          title: 'Component Name',
          type: 'string',
          description: 'Unique name for your component',
          'ui:field': 'ComponentNamePicker',
        },
        displayName: {
          title: 'Display Name',
          type: 'string',
          description: 'Human-readable display name',
        },
        description: {
          title: 'Description',
          type: 'string',
          description: 'Brief description of what this component does',
        },
      },
    };

    // Always show Component Metadata first so the user provides project/namespace
    // context before configuring Build & Deploy fields.
    parameters.push(metadataSection);

    // Build & Deploy (deployment source selection + conditional fields)
    parameters.push(
      this.generateCISetupSection(componentType, namespaceName, ctdKind),
    );

    // Workload Details (CTD params, endpoints, env vars, file mounts, traits)
    parameters.push(
      this.generateWorkloadDetailsSection(componentType, namespaceName),
    );

    return parameters;
  }

  /**
   * Generate Workload Details section
   * Consolidates CTD parameters, endpoints, env vars, file mounts, and traits
   * into a single composite field extension
   */
  private generateWorkloadDetailsSection(
    componentType: ComponentType,
    namespaceName: string,
  ): any {
    return {
      title: `${
        componentType.metadata.displayName ||
        this.formatTitle(componentType.metadata.name)
      } Details`,
      properties: {
        workloadDetails: {
          title: 'Workload Details',
          type: 'object',
          'ui:field': 'WorkloadDetailsField',
          'ui:options': {
            namespaceName: namespaceName,
            workloadType: componentType.metadata.workloadType,
            ctdSchema: componentType.spec.inputParametersSchema,
            ctdDisplayName:
              componentType.metadata.displayName ||
              this.formatTitle(componentType.metadata.name),
            allowedTraits: componentType.metadata.allowedTraits,
          },
        },
      },
    };
  }

  /**
   * Generate CI/CD Setup section with workflow configuration or from-image deployment
   * Allows users to choose between building from source or deploying from a pre-built image.
   */
  private generateCISetupSection(
    componentType: ComponentType,
    namespaceName: string,
    ctdKind: 'ComponentType' | 'ClusterComponentType' = 'ComponentType',
  ): any {
    const rawAllowedWorkflows = componentType.metadata.allowedWorkflows;
    const defaultWorkflowKind =
      ctdKind === 'ClusterComponentType' ? 'ClusterWorkflow' : 'Workflow';
    const allowedWorkflows =
      rawAllowedWorkflows
        ?.map(workflow => {
          if (!workflow) return null;
          if (typeof workflow === 'string') {
            return { kind: defaultWorkflowKind, name: workflow };
          }
          if (!workflow.name) return null;
          return {
            kind: workflow.kind ?? defaultWorkflowKind,
            name: workflow.name,
          };
        })
        ?.filter((w): w is { kind: string; name: string } =>
          Boolean(w?.name),
        ) ?? [];

    // Build workflow field properties
    const workflowField: any = {
      title: 'Build Workflow',
      type: 'object',
      description: 'Select the build workflow to use for this component',
      properties: {
        kind: {
          title: 'Workflow Kind',
          type: 'string',
        },
        name: {
          title: 'Workflow Name',
          type: 'string',
        },
      },
      required: ['kind', 'name'],
      'ui:field': 'BuildWorkflowPicker',
      'ui:options': {
        namespaceName: namespaceName,
        ctdKind: ctdKind,
        allowedWorkflows,
      },
    };

    // Auto Deploy field - only for deploy-from-image (build-from-source and external-ci don't have an immediate image to deploy)
    const autoDeployField = {
      title: 'Auto Deploy',
      description:
        'Automatically deploys the component to the first target environment once built',
      type: 'boolean',
      default: false,
      'ui:field': 'SwitchField',
    };

    return {
      title: 'Build & Deploy',
      required: ['deploymentSource'],
      properties: {
        deploymentSource: {
          title: 'Deployment Source',
          type: 'string',
          description: 'Choose how to deploy your component',
          enum: ['build-from-source', 'deploy-from-image', 'external-ci'],
          'ui:field': 'DeploymentSourcePicker',
        },
      },
      dependencies: {
        deploymentSource: {
          oneOf: [
            // Build from source branch
            {
              properties: {
                deploymentSource: {
                  const: 'build-from-source',
                },
                workflow_name: workflowField,
                git_source: {
                  title: 'Source Repository',
                  type: 'object',
                  'ui:field': 'GitSourceField',
                  'ui:options': {
                    namespaceName: namespaceName,
                  },
                  properties: {
                    repo_url: { type: 'string' },
                    branch: { type: 'string' },
                    component_path: { type: 'string' },
                    git_secret_ref: { type: 'string' },
                  },
                },
                workflow_parameters: {
                  title: 'Workflow Parameters',
                  type: 'object',
                  'ui:field': 'BuildWorkflowParameters',
                  'ui:options': {
                    namespaceName: namespaceName,
                    ctdKind: ctdKind,
                  },
                },
              },
              required: ['workflow_name', 'workflow_parameters'],
            },
            // Deploy from image branch
            {
              properties: {
                deploymentSource: {
                  const: 'deploy-from-image',
                },
                containerImage: {
                  title: 'Container Image',
                  type: 'string',
                  description:
                    'Full image reference (e.g., ghcr.io/org/app:v1.0.0 or nginx:latest)',
                  'ui:field': 'ContainerImageField',
                },
                autoDeploy: autoDeployField,
              },
              required: ['containerImage'],
            },
            // External CI branch
            {
              properties: {
                deploymentSource: {
                  const: 'external-ci',
                },
                ciPlatform: {
                  title: 'CI Platform (Optional)',
                  type: 'string',
                  description:
                    'Select your CI platform to enable build visibility in Backstage. You can configure this later via the annotation editor.',
                  enum: ['none', 'jenkins', 'github-actions', 'gitlab-ci'],
                  enumNames: [
                    "Skip - I'll configure this later",
                    'Jenkins',
                    'GitHub Actions',
                    'GitLab CI',
                  ],
                  default: 'none',
                },
              },
            },
          ],
        },
        ciPlatform: {
          oneOf: [
            {
              properties: {
                ciPlatform: { const: 'none' },
              },
            },
            {
              properties: {
                ciPlatform: { const: 'jenkins' },
                ciIdentifier: {
                  title: 'Jenkins Job Path',
                  type: 'string',
                  description:
                    'Full job path (e.g., /job/my-org/job/my-service or folder/job-name)',
                },
              },
            },
            {
              properties: {
                ciPlatform: { const: 'github-actions' },
                ciIdentifier: {
                  title: 'GitHub Repository Slug',
                  type: 'string',
                  description: 'Repository slug (e.g., my-org/my-repo)',
                },
              },
            },
            {
              properties: {
                ciPlatform: { const: 'gitlab-ci' },
                ciIdentifier: {
                  title: 'GitLab Project ID',
                  type: 'string',
                  description: 'Numeric project ID from GitLab',
                },
              },
            },
          ],
        },
      },
    };
  }

  /**
   * Convert a ClusterComponentType to a Backstage Template entity.
   * Unlike namespace-scoped templates, cluster templates:
   * - Use 'openchoreo-cluster' namespace
   * - Add CTD_KIND annotation to identify the source as ClusterComponentType
   * - Pass component_type_kind: 'ClusterComponentType' to the scaffolder action
   * - Pass empty namespaceName (ProjectNamespaceField renders a namespace dropdown)
   * - AllowedTraits are exclusively ClusterTraits
   */
  convertClusterCtdToTemplateEntity(componentType: ComponentType): Entity {
    const templateName = this.generateTemplateName(componentType.metadata.name);
    const title =
      componentType.metadata.displayName ||
      this.formatTitle(componentType.metadata.name);
    const description =
      componentType.metadata.description || `Create a ${title} component`;

    const templateEntity: Entity = {
      apiVersion: 'scaffolder.backstage.io/v1beta3',
      kind: 'Template',
      metadata: {
        name: templateName,
        namespace: CLUSTER_WORKFLOW_NAMESPACE,
        title,
        description,
        annotations: {
          [CHOREO_ANNOTATIONS.CTD_NAME]: componentType.metadata.name,
          [CHOREO_ANNOTATIONS.CTD_GENERATED]: 'true',
          [CHOREO_ANNOTATIONS.CTD_KIND]: 'ClusterComponentType',
          [CHOREO_ANNOTATIONS.WORKLOAD_TYPE]:
            componentType.metadata.workloadType,
        },
      },
      spec: {
        owner: this.defaultOwner,
        type: 'Component',
        EXPERIMENTAL_formDecorators: [{ id: 'openchoreo:inject-user-token' }],
        parameters: this.generateParameters(
          componentType,
          '',
          'ClusterComponentType',
        ),
        steps: this.generateSteps(componentType, 'ClusterComponentType'),
        output: {
          links: [
            {
              title: 'View Component',
              icon: 'kind:component',
              entityRef:
                "component:${{ steps['create-component'].output.namespaceName }}/${{ steps['create-component'].output.componentName }}",
            },
          ],
        },
      },
    };

    if (componentType.metadata.displayName) {
      templateEntity.metadata.annotations![
        CHOREO_ANNOTATIONS.CTD_DISPLAY_NAME
      ] = componentType.metadata.displayName;
    }

    return templateEntity;
  }

  /**
   * Generate scaffolder steps for the template
   */
  private generateSteps(
    componentType: ComponentType,
    componentTypeKind:
      | 'ComponentType'
      | 'ClusterComponentType' = 'ComponentType',
  ): any[] {
    return [
      {
        id: 'create-component',
        name: 'Create OpenChoreo Component',
        action: 'openchoreo:component:create',
        input: {
          // Component Metadata (from section 3)
          namespaceName: '${{ parameters.project_namespace.namespace_name }}',
          projectName: '${{ parameters.project_namespace.project_name }}',
          componentName: '${{ parameters.component_name }}',
          displayName: '${{ parameters.displayName }}',
          description: '${{ parameters.description }}',

          // Component Type
          componentType: componentType.metadata.name,
          component_type_workload_type: componentType.metadata.workloadType,
          component_type_kind: componentTypeKind,

          // Workload Details (from section 2 — nested under workloadDetails)
          workloadDetails: '${{ parameters.workloadDetails }}',

          // CI/CD Setup (from section 1)
          deploymentSource: '${{ parameters.deploymentSource }}',
          autoDeploy: '${{ parameters.autoDeploy }}',
          containerImage: '${{ parameters.containerImage }}',
          repo_url: '${{ parameters.git_source.repo_url }}',
          branch: '${{ parameters.git_source.branch }}',
          component_path: '${{ parameters.git_source.component_path }}',
          gitSecretRef: '${{ parameters.git_source.git_secret_ref }}',
          workflow: '${{ parameters.workflow_name }}',
          workflow_parameters: '${{ parameters.workflow_parameters }}',
          // External CI parameters
          ciPlatform: '${{ parameters.ciPlatform }}',
          ciIdentifier: '${{ parameters.ciIdentifier }}',
        },
      },
    ];
  }
}
