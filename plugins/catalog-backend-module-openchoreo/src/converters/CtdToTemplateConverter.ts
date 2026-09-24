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

/** A configured git provider that can host newly-created repositories. */
export interface GitProviderConfig {
  /** Integration key, e.g. 'github', 'gitlab'. */
  provider: string;
  /** Host, e.g. 'github.com'. */
  host: string;
  /** Scaffolder publish action id, e.g. 'publish:github'. */
  publishAction: string;
}

/** Starter-skeleton source used to seed created repos with buildable content. */
export interface StarterSkeletonConfig {
  /** Base URL, e.g. `https://github.com/org/skeletons/tree/main`; runtime is appended. */
  baseUrl?: string;
  /** Runtime keys per workloadType (e.g. { Service: ['react', 'java'] }). */
  runtimes?: Record<string, string[]>;
  /** Fallback runtimes when a workloadType has no explicit entry. */
  defaultRuntimes?: string[];
}

/**
 * Configuration for the Component Type to Template converter
 */
export interface CtdConverterConfig {
  /**
   * Default owner for generated templates (required by Backstage Template kind schema)
   */
  defaultOwner?: string;
  /** Git providers available for in-wizard repo creation; empty disables it. */
  gitProviders?: GitProviderConfig[];
  /** Master switch for in-wizard repo creation. Defaults to true. */
  repoCreationEnabled?: boolean;
  /** Starter-skeleton source used to seed created repositories. */
  starterSkeletons?: StarterSkeletonConfig;
}

/** Maps an `integrations.*` key to its scaffolder publish action id. */
const PROVIDER_PUBLISH_ACTIONS: Record<string, string> = {
  github: 'publish:github',
  gitlab: 'publish:gitlab',
  bitbucketCloud: 'publish:bitbucketCloud',
  bitbucketServer: 'publish:bitbucketServer',
  azure: 'publish:azure',
  gitea: 'publish:gitea',
};

/** Runtimes offered when neither the workloadType nor config specify any. */
const DEFAULT_RUNTIMES = ['react', 'nodejs', 'java', 'python', 'go'];

/**
 * Converts OpenChoreo Component Types to Backstage Template entities
 */
export class CtdToTemplateConverter {
  private readonly defaultOwner: string;
  private readonly gitProviders: GitProviderConfig[];
  private readonly repoCreationConfigEnabled: boolean;
  private readonly starterSkeletons?: StarterSkeletonConfig;

  constructor(config?: CtdConverterConfig) {
    this.defaultOwner = config?.defaultOwner || 'guests';
    this.gitProviders = config?.gitProviders ?? [];
    this.repoCreationConfigEnabled = config?.repoCreationEnabled ?? true;
    this.starterSkeletons = config?.starterSkeletons;
  }

  /** Scaffolder publish action id for an integration key, if known. */
  static publishActionForProvider(provider: string): string | undefined {
    return PROVIDER_PUBLISH_ACTIONS[provider];
  }

  /**
   * Repo creation is available only when enabled by config AND at least one
   * git provider is configured. When off, templates render existing-repo only
   * and no fetch/publish steps are emitted.
   */
  private get repoCreationEnabled(): boolean {
    return this.repoCreationConfigEnabled && this.gitProviders.length > 0;
  }

  /** Runtimes to offer for a workloadType, honoring config overrides. */
  private runtimesForWorkloadType(workloadType: string): string[] {
    const configured =
      this.starterSkeletons?.runtimes?.[workloadType] ??
      this.starterSkeletons?.defaultRuntimes;
    return configured && configured.length > 0 ? configured : DEFAULT_RUNTIMES;
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
        owner: {
          title: 'Owner',
          type: 'string',
          description:
            'The group that owns this component.',
          'ui:field': 'OwnerPicker',
          'ui:options': {
            catalogFilter: {
              kind: ['Group'],
            },
          },
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

    // All branch-specific fields live as siblings of `deploymentSource` under a
    // single `buildAndDeploy` object owned by `BuildAndDeployField`. The
    // composite renders only the fields belonging to the current
    // deploymentSource, and replaces its entire object atomically on source
    // change — siblings from the previous branch disappear in one onChange.
    // This avoids RJSF's stale-data-on-oneOf-switch behaviour, which Backstage's
    // Stepper blocks from being fixed via omitExtraData/liveOmit.
    const buildAndDeployObject: any = {
      type: 'object',
      'ui:field': 'BuildAndDeployField',
      required: ['deploymentSource'],
      properties: {
        deploymentSource: {
          title: 'Deployment Source',
          type: 'string',
          description: 'Choose how to deploy your component',
          enum: ['build-from-source', 'deploy-from-image', 'external-ci'],
          'ui:field': 'DeploymentSourcePicker',
        },
        // build-from-source branch
        workflow_name: workflowField,
        git_source: this.generateGitSourceField(
          componentType,
          namespaceName,
        ),
        workflow_parameters: {
          title: 'Workflow Parameters',
          type: 'object',
          'ui:field': 'BuildWorkflowParameters',
          'ui:options': {
            namespaceName: namespaceName,
            ctdKind: ctdKind,
          },
        },
        // deploy-from-image branch
        containerImage: {
          title: 'Container Image',
          type: 'string',
          description:
            'Full image reference (e.g., ghcr.io/org/app:v1.0.0 or nginx:latest)',
          'ui:field': 'ContainerImageField',
        },
        autoDeploy: autoDeployField,
        // external-ci branch
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
        // Rendered by BuildAndDeployField only when ciPlatform requires it.
        // Title/description are platform-specific, so this field carries a
        // generic shape and the picker UI provides the specific labelling.
        ciIdentifier: {
          title: 'CI Job / Project Identifier',
          type: 'string',
          description:
            'Identifier for the external CI job (e.g., Jenkins job full name such as ' +
            '`my-folder/my-job`, GitHub repo slug, or GitLab project ID).',
        },
      },
    };

    return {
      title: 'Build & Deploy',
      required: ['buildAndDeploy'],
      properties: {
        buildAndDeploy: buildAndDeployObject,
      },
    };
  }

  /**
   * Build the `git_source` field. With git providers configured it also carries
   * the create-repo options; otherwise it's the existing repo-only field.
   */
  private generateGitSourceField(
    componentType: ComponentType,
    namespaceName: string,
  ): any {
    const uiOptions: Record<string, any> = { namespaceName };
    const properties: Record<string, any> = {
      repo_url: { type: 'string' },
      branch: { type: 'string' },
      component_path: { type: 'string' },
      git_secret_ref: { type: 'string' },
    };

    if (this.repoCreationEnabled) {
      uiOptions.repoCreation = {
        providers: this.gitProviders.map(p => ({
          provider: p.provider,
          host: p.host,
        })),
        // 'config' → curated runtime dropdown; 'url' → optional user URL field
        // (falls back to an empty repo when left blank).
        ...(this.starterSkeletons?.baseUrl
          ? {
              starterMode: 'config',
              runtimes: this.runtimesForWorkloadType(
                componentType.metadata.workloadType,
              ),
            }
          : { starterMode: 'url' }),
      };
      // create-repo values consumed by the publish/fetch steps
      properties.mode = { type: 'string' };
      properties.provider = { type: 'string' };
      properties.repo_host = { type: 'string' };
      properties.repoUrl = { type: 'string' };
      properties.owner = { type: 'string' };
      properties.repo_name = { type: 'string' };
      properties.visibility = { type: 'string' };
      properties.runtime = { type: 'string' };
      properties.starter_url = { type: 'string' };
    }

    return {
      title: 'Source Repository',
      type: 'object',
      'ui:field': 'GitSourceField',
      'ui:options': uiOptions,
      properties,
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
   * Generate scaffolder steps for the template.
   * With git providers configured, a create-repo flow (skeleton fetch +
   * per-provider publish) is prepended and `repo_url` resolves from whichever
   * publish ran, else from the user-entered existing repo.
   */
  private generateSteps(
    componentType: ComponentType,
    componentTypeKind:
      | 'ComponentType'
      | 'ClusterComponentType' = 'ComponentType',
  ): any[] {
    const repoSteps = this.generateRepoCreationSteps(componentType);
    return [
      ...repoSteps,
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
          owner: '${{ parameters.owner }}',

          // Component Type
          componentType: componentType.metadata.name,
          component_type_workload_type: componentType.metadata.workloadType,
          component_type_kind: componentTypeKind,

          // Workload Details (from section 2 — nested under workloadDetails)
          workloadDetails: '${{ parameters.workloadDetails }}',

          // CI/CD Setup (from section 1 — nested under buildAndDeploy)
          deploymentSource: '${{ parameters.buildAndDeploy.deploymentSource }}',
          autoDeploy: '${{ parameters.buildAndDeploy.autoDeploy }}',
          containerImage: '${{ parameters.buildAndDeploy.containerImage }}',
          repo_url: this.repoUrlExpression(),
          branch: '${{ parameters.buildAndDeploy.git_source.branch }}',
          component_path:
            '${{ parameters.buildAndDeploy.git_source.component_path }}',
          gitSecretRef:
            '${{ parameters.buildAndDeploy.git_source.git_secret_ref }}',
          workflow: '${{ parameters.buildAndDeploy.workflow_name }}',
          workflow_parameters:
            '${{ parameters.buildAndDeploy.workflow_parameters }}',
          // External CI parameters
          ciPlatform: '${{ parameters.buildAndDeploy.ciPlatform }}',
          ciIdentifier: '${{ parameters.buildAndDeploy.ciIdentifier }}',
        },
      },
    ];
  }

  /**
   * Conditional steps that seed a skeleton and publish a new repo. All are
   * gated on create mode, so they no-op for existing-repo or non-source flows.
   */
  private generateRepoCreationSteps(componentType: ComponentType): any[] {
    if (!this.repoCreationEnabled) return [];

    const createMode =
      "${{ parameters.buildAndDeploy.git_source.mode == 'create' }}";
    const steps: any[] = [];

    const baseUrl = this.starterSkeletons?.baseUrl;
    if (baseUrl) {
      // Config mode: curated skeleton templated from the configured base URL.
      steps.push({
        id: 'fetch-skeleton',
        name: 'Fetch starter skeleton',
        if: createMode,
        action: 'fetch:template',
        input: {
          url: `${baseUrl.replace(/\/$/, '')}/\${{ parameters.buildAndDeploy.git_source.runtime }}`,
          values: {
            componentName: '${{ parameters.component_name }}',
            description: '${{ parameters.description }}',
            workloadType: componentType.metadata.workloadType,
          },
        },
      });
    } else {
      // URL mode (no config): copy the user-provided starter verbatim, only
      // when supplied. Blank starter_url → no fetch → empty repo.
      steps.push({
        id: 'fetch-skeleton',
        name: 'Fetch starter template',
        if: "${{ parameters.buildAndDeploy.git_source.mode == 'create' and parameters.buildAndDeploy.git_source.starter_url }}",
        action: 'fetch:plain',
        input: {
          url: '${{ parameters.buildAndDeploy.git_source.starter_url }}',
        },
      });
    }

    for (const { provider, publishAction } of this.gitProviders) {
      steps.push({
        id: `publish-${provider}`,
        name: `Create repository (${provider})`,
        if: `\${{ parameters.buildAndDeploy.git_source.mode == 'create' and parameters.buildAndDeploy.git_source.provider == '${provider}' }}`,
        action: publishAction,
        input: {
          repoUrl: '${{ parameters.buildAndDeploy.git_source.repoUrl }}',
          description: '${{ parameters.description }}',
          defaultBranch: '${{ parameters.buildAndDeploy.git_source.branch }}',
          repoVisibility:
            '${{ parameters.buildAndDeploy.git_source.visibility }}',
        },
      });
    }

    return steps;
  }

  /**
   * Resolve repo_url from whichever publish step ran, else the existing repo.
   */
  private repoUrlExpression(): string {
    if (!this.repoCreationEnabled) {
      return '${{ parameters.buildAndDeploy.git_source.repo_url }}';
    }
    const publishOutputs = this.gitProviders.map(
      p => `steps['publish-${p.provider}'].output.remoteUrl`,
    );
    const chain = [
      ...publishOutputs,
      'parameters.buildAndDeploy.git_source.repo_url',
    ].join(' or ');
    return `\${{ ${chain} }}`;
  }
}
