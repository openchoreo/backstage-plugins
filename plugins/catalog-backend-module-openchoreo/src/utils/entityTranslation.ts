import { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  CHOREO_LABELS,
  getRepositoryInfo,
  ComponentTypeUtils,
  type ComponentResponse,
} from '@openchoreo/backstage-plugin-common';
import {
  getName,
  getNamespace,
  getUid,
  getCreatedAt,
  getDeletionTimestamp,
  getDisplayName,
  getDescription,
  isReady,
  isCreated,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import type {
  EnvironmentEntityV1alpha1,
  DataplaneEntityV1alpha1,
  WorkflowPlaneEntityV1alpha1,
  ObservabilityPlaneEntityV1alpha1,
  ComponentTypeEntityV1alpha1,
  TraitTypeEntityV1alpha1,
  WorkflowEntityV1alpha1,
  ClusterComponentTypeEntityV1alpha1,
  ClusterTraitTypeEntityV1alpha1,
  ClusterWorkflowEntityV1alpha1,
  ClusterDataplaneEntityV1alpha1,
  ClusterObservabilityPlaneEntityV1alpha1,
  ClusterWorkflowPlaneEntityV1alpha1,
  ClusterResourceTypeEntityV1alpha1,
  ResourceTypeEntityV1alpha1,
  ClusterProjectTypeEntityV1alpha1,
  ProjectTypeEntityV1alpha1,
  DeploymentPipelineEntityV1alpha1,
  ObservabilityAlertsNotificationChannelEntityV1alpha1,
  NotificationEmailConfig,
  NotificationWebhookConfig,
} from '../kinds';
import { normalizeObservabilityPlaneRef, resolveProjectOwner } from './helpers';

type ModelsComponent = ComponentResponse;

// New-API resource shapes used by the adapter functions below
type NewProject = OpenChoreoComponents['schemas']['Project'];
type NewComponent = OpenChoreoComponents['schemas']['Component'];
type NewEnvironment = OpenChoreoComponents['schemas']['Environment'];
type NewNotificationChannel =
  OpenChoreoComponents['schemas']['ObservabilityAlertsNotificationChannel'];
type NewDataPlane = OpenChoreoComponents['schemas']['DataPlane'];
type NewWorkflowPlane = OpenChoreoComponents['schemas']['WorkflowPlane'];
type NewObservabilityPlane =
  OpenChoreoComponents['schemas']['ObservabilityPlane'];
type NewDeploymentPipeline =
  OpenChoreoComponents['schemas']['DeploymentPipeline'];
type NewComponentType = OpenChoreoComponents['schemas']['ComponentType'];
type NewTrait = OpenChoreoComponents['schemas']['Trait'];
type NewWorkflow = OpenChoreoComponents['schemas']['Workflow'];
type NewClusterComponentType =
  OpenChoreoComponents['schemas']['ClusterComponentType'];
type NewClusterTrait = OpenChoreoComponents['schemas']['ClusterTrait'];
type NewClusterWorkflow = OpenChoreoComponents['schemas']['ClusterWorkflow'];
type NewClusterDataPlane = OpenChoreoComponents['schemas']['ClusterDataPlane'];
type NewClusterObservabilityPlane =
  OpenChoreoComponents['schemas']['ClusterObservabilityPlane'];
type NewClusterWorkflowPlane =
  OpenChoreoComponents['schemas']['ClusterWorkflowPlane'];
type NewClusterResourceType =
  OpenChoreoComponents['schemas']['ClusterResourceType'];
type NewResourceType = OpenChoreoComponents['schemas']['ResourceType'];
type NewClusterProjectType =
  OpenChoreoComponents['schemas']['ClusterProjectType'];
type NewProjectType = OpenChoreoComponents['schemas']['ProjectType'];
type NewResource = OpenChoreoComponents['schemas']['ResourceInstance'];
type NewNamespace = OpenChoreoComponents['schemas']['Namespace'];
type NewAgentConnectionStatus =
  OpenChoreoComponents['schemas']['AgentConnectionStatus'];
type AllowedTraitRef = { kind?: string; name: string };
type AllowedWorkflowRef = { kind?: string; name: string };

const COMPONENT_REPOSITORY_EXTENSIONS: Record<string, string> = {
  'x-openchoreo-component-parameter-repository-url': 'repoUrl',
  'x-openchoreo-component-parameter-repository-branch': 'branch',
  'x-openchoreo-component-parameter-repository-commit': 'commit',
  'x-openchoreo-component-parameter-repository-app-path': 'appPath',
  'x-openchoreo-component-parameter-repository-secret-ref': 'secretRef',
};

function walkSchemaForExtensions(
  properties: Record<string, any>,
  prefix: string,
  mapping: Record<string, string>,
): void {
  for (const [propName, propSchema] of Object.entries(properties)) {
    if (!propSchema || typeof propSchema !== 'object') continue;
    const currentPath = `${prefix}.${propName}`;
    for (const [ext, key] of Object.entries(COMPONENT_REPOSITORY_EXTENSIONS)) {
      if (propSchema[ext] === true) {
        mapping[key] = currentPath;
      }
    }
    if (propSchema.properties) {
      walkSchemaForExtensions(propSchema.properties, currentPath, mapping);
    }
  }
}

/**
 * Extracts workflow parameter path mappings from a workflow spec's schema extensions.
 * The new API uses x-openchoreo-component-parameter-repository-* extensions on schema
 * properties instead of the openchoreo.dev/component-workflow-parameters annotation.
 *
 * Returns the annotation-compatible string format (e.g., "repoUrl: parameters.repository.url")
 * so existing consumers continue to work without changes.
 */
export function extractWorkflowParameters(spec: any): string | undefined {
  const schemaSection = spec?.parameters || spec?.schema?.parameters;
  const schema = schemaSection?.openAPIV3Schema || schemaSection?.ocSchema;
  if (!schema?.properties) return undefined;

  const mapping: Record<string, string> = {};
  walkSchemaForExtensions(schema.properties, 'parameters', mapping);

  if (Object.keys(mapping).length === 0) return undefined;
  return Object.entries(mapping)
    .map(([key, path]) => `${key}: ${path}`)
    .join('\n');
}

const normalizeAllowedTraits = (
  traits: Array<string | AllowedTraitRef> | undefined,
  defaultKind: 'Trait' | 'ClusterTrait',
): AllowedTraitRef[] | undefined => {
  if (!traits) return undefined;
  if (traits.length === 0) return [];

  return traits
    .map(trait => {
      if (!trait) return null;
      if (typeof trait === 'string') {
        const [maybeKind, ...rest] = trait.split(':');
        if (
          rest.length > 0 &&
          (maybeKind === 'Trait' || maybeKind === 'ClusterTrait')
        ) {
          return { kind: maybeKind, name: rest.join(':') };
        }
        return { kind: defaultKind, name: trait };
      }

      return { kind: trait.kind ?? defaultKind, name: trait.name };
    })
    .filter((trait): trait is NonNullable<typeof trait> =>
      Boolean(trait?.name),
    );
};

const WORKFLOW_KINDS = new Set([
  'ComponentWorkflow',
  'Workflow',
  'ClusterWorkflow',
]);

const normalizeAllowedWorkflows = (
  workflows: Array<string | AllowedWorkflowRef> | undefined,
  defaultKind: 'Workflow' | 'ClusterWorkflow',
): AllowedWorkflowRef[] | undefined => {
  if (!workflows) return undefined;
  if (workflows.length === 0) return [];

  return workflows
    .map(workflow => {
      if (!workflow) return null;
      if (typeof workflow === 'string') {
        const [maybeKind, ...rest] = workflow.split(':');
        if (rest.length > 0 && WORKFLOW_KINDS.has(maybeKind)) {
          return { kind: maybeKind, name: rest.join(':') };
        }
        return { kind: defaultKind, name: workflow };
      }

      return { kind: workflow.kind ?? defaultKind, name: workflow.name };
    })
    .filter((workflow): workflow is NonNullable<typeof workflow> =>
      Boolean(workflow?.name),
    );
};

/**
 * Configuration for component entity translation
 */
export interface ComponentEntityTranslationConfig {
  /**
   * Default owner for the component entity (required by Backstage Component kind schema)
   */
  defaultOwner: string;
  /**
   * Component type utilities for generating tags
   */
  componentTypeUtils: ComponentTypeUtils;
  /**
   * Location key for the entity (identifies which provider manages it)
   */
  locationKey: string;
}

/**
 * Translates an OpenChoreo ModelsComponent to a Backstage Component entity.
 * This is a shared utility used by both the scheduled sync (OpenChoreoEntityProvider)
 * and immediate insertion (scaffolder action) to ensure consistency.
 *
 * @param component - Component from OpenChoreo API
 * @param namespaceName - Namespace name
 * @param projectName - Project name
 * @param config - Translation configuration
 * @param providesApis - Optional list of API entity refs this component provides
 * @returns Backstage Component entity
 */
export function translateComponentToEntity(
  component: ModelsComponent,
  namespaceName: string,
  projectName: string,
  config: ComponentEntityTranslationConfig,
  providesApis?: string[],
  consumesApis?: string[],
  /**
   * Backstage entity refs (e.g. `resource:<ns>/<name>`) populated into
   * `spec.dependsOn` so Backstage's built-in processor emits the
   * Component → Resource `dependsOn` relation. Omitted from the entity
   * when empty/undefined.
   */
  dependsOn?: string[],
): Entity {
  const componentEntity: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: component.name,
      title: component.displayName || component.name,
      namespace: namespaceName,
      ...(component.description && { description: component.description }),
      tags: config.componentTypeUtils.generateTags(component.type || 'unknown'),
      annotations: {
        'backstage.io/managed-by-location': config.locationKey,
        'backstage.io/managed-by-origin-location': config.locationKey,
        [CHOREO_ANNOTATIONS.COMPONENT]: component.name,
        ...(component.uid && {
          [CHOREO_ANNOTATIONS.COMPONENT_UID]: component.uid,
        }),
        ...(component.type && {
          [CHOREO_ANNOTATIONS.COMPONENT_TYPE]: component.type,
        }),
        ...(component.componentType?.kind && {
          [CHOREO_ANNOTATIONS.COMPONENT_TYPE_KIND]:
            component.componentType.kind,
        }),
        [CHOREO_ANNOTATIONS.PROJECT]: projectName,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        ...(component.createdAt && {
          [CHOREO_ANNOTATIONS.CREATED_AT]: component.createdAt,
        }),
        ...(component.status && {
          [CHOREO_ANNOTATIONS.STATUS]: component.status,
        }),
        ...(component.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: component.deletionTimestamp,
        }),
        ...(() => {
          const repoInfo = getRepositoryInfo(component);
          return {
            ...(repoInfo.url && {
              'backstage.io/source-location': `url:${repoInfo.url}`,
            }),
            ...(repoInfo.branch && {
              [CHOREO_ANNOTATIONS.BRANCH]: repoInfo.branch,
            }),
          };
        })(),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      type: component.type || 'unknown',
      lifecycle: component.status?.toLowerCase() || 'unknown', // Map status to lifecycle
      owner: config.defaultOwner,
      system: projectName, // Link to the parent system (project)
      ...(providesApis && providesApis.length > 0 && { providesApis }),
      ...(consumesApis && consumesApis.length > 0 && { consumesApis }),
      ...(dependsOn && dependsOn.length > 0 && { dependsOn }),
    },
  };

  return componentEntity;
}

/**
 * Base configuration for entity translation
 */
export interface EntityTranslationConfig {
  locationKey: string;
}

/**
 * Configuration for project entity translation
 */
export interface ProjectEntityTranslationConfig
  extends EntityTranslationConfig {
  defaultOwner: string;
}

/**
 * Translates an OpenChoreo Project to a Backstage System entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateProjectToEntity(
  project: {
    name: string;
    displayName?: string;
    description?: string;
    namespaceName?: string;
    uid?: string;
    deletionTimestamp?: string;
    /**
     * Name of the DeploymentPipeline this project references
     * (mirrors `Project.spec.deploymentPipelineRef.name` on the OC CR).
     * Surfaced on the System entity so the System processor can emit the
     * `usesPipeline` / `pipelineUsedBy` relation pair from this side —
     * removing the need for the DP entity to carry an inverted-index
     * `projectRefs` array.
     */
    deploymentPipelineRef?: string;
    /**
     * Name of the (Cluster)ProjectType this project references
     * (`Project.spec.type.name` on the OC CR). Surfaced as the
     * `openchoreo.io/project-type` annotation so SystemEntityProcessor can
     * emit the `instanceOf` / `hasInstance` relation pair to the type,
     * mirroring how Resources link to their (Cluster)ResourceType.
     */
    projectTypeName?: string;
    /**
     * Kind disambiguation for the project-type ref — `ProjectType`
     * (namespaced) or `ClusterProjectType` (cluster-scoped).
     */
    projectTypeKind?: 'ProjectType' | 'ClusterProjectType';
  },
  namespaceName: string,
  config: ProjectEntityTranslationConfig,
): Entity {
  const systemEntity: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'System',
    metadata: {
      name: project.name,
      title: project.displayName || project.name,
      description: project.description || project.name,
      namespace: project.namespaceName,
      tags: ['openchoreo', 'project'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.PROJECT_ID]: project.name,
        ...(project.uid && {
          [CHOREO_ANNOTATIONS.PROJECT_UID]: project.uid,
        }),
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        ...(project.projectTypeName && {
          [CHOREO_ANNOTATIONS.PROJECT_TYPE]: project.projectTypeName,
          [CHOREO_ANNOTATIONS.PROJECT_TYPE_KIND]:
            project.projectTypeKind ?? 'ProjectType',
        }),
        ...(project.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: project.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      owner: config.defaultOwner,
      domain: `default/${namespaceName}`,
      ...(project.deploymentPipelineRef && {
        deploymentPipelineRef: project.deploymentPipelineRef,
      }),
    },
  };

  return systemEntity;
}

/**
 * Translates an OpenChoreo Environment to a Backstage Environment entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateEnvironmentToEntity(
  environment: {
    name: string;
    displayName?: string;
    description?: string;
    uid?: string;
    isProduction?: boolean;
    dataPlaneRef?: { kind?: string; name?: string };
    dnsPrefix?: string;
    gateway?: {
      ingress?: {
        external?: {
          name?: string;
          namespace?: string;
          http?: { host?: string; port?: number };
          https?: { host?: string; port?: number };
        };
        internal?: {
          name?: string;
          namespace?: string;
          http?: { host?: string; port?: number };
          https?: { host?: string; port?: number };
        };
      };
    };
    createdAt?: string;
    status?: string;
    deletionTimestamp?: string;
  },
  namespaceName: string,
  config: EntityTranslationConfig,
): EnvironmentEntityV1alpha1 {
  const environmentEntity: EnvironmentEntityV1alpha1 = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Environment',
    metadata: {
      name: environment.name,
      namespace: namespaceName,
      title: environment.displayName || environment.name,
      description: environment.description || `${environment.name} environment`,
      tags: [
        'openchoreo',
        'environment',
        environment.isProduction ? 'production' : 'non-production',
      ],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.ENVIRONMENT]: environment.name,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        ...(environment.uid && {
          [CHOREO_ANNOTATIONS.ENVIRONMENT_UID]: environment.uid,
        }),
        ...(environment.createdAt && {
          [CHOREO_ANNOTATIONS.CREATED_AT]: environment.createdAt,
        }),
        ...(environment.status && {
          [CHOREO_ANNOTATIONS.STATUS]: environment.status,
        }),
        ...(environment.dataPlaneRef?.name && {
          'openchoreo.io/data-plane-ref': environment.dataPlaneRef.name,
        }),
        ...(environment.dataPlaneRef?.kind && {
          [CHOREO_ANNOTATIONS.DATA_PLANE_REF_KIND]:
            environment.dataPlaneRef.kind,
        }),
        ...(environment.dnsPrefix && {
          'openchoreo.io/dns-prefix': environment.dnsPrefix,
        }),
        ...(environment.isProduction !== undefined && {
          'openchoreo.io/is-production': environment.isProduction.toString(),
        }),
        ...(environment.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]:
            environment.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
        ...(environment.isProduction !== undefined && {
          'openchoreo.io/environment-type': environment.isProduction
            ? 'production'
            : 'non-production',
        }),
      },
    },
    spec: {
      type: environment.isProduction ? 'production' : 'non-production',
      domain: `default/${namespaceName}`,
      isProduction: environment.isProduction,
      dataPlaneRef: environment.dataPlaneRef?.name,
      dnsPrefix: environment.dnsPrefix,
      ...(environment.gateway && { gateway: environment.gateway }),
    },
  };

  return environmentEntity;
}

/**
 * Translates an OpenChoreo ObservabilityAlertsNotificationChannel to a
 * Backstage ObservabilityAlertsNotificationChannel entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateNotificationChannelToEntity(
  channel: {
    name: string;
    displayName?: string;
    description?: string;
    environment: string;
    isEnvDefault?: boolean;
    type: 'email' | 'webhook';
    emailConfig?: NotificationEmailConfig;
    webhookConfig?: NotificationWebhookConfig;
    createdAt?: string;
    deletionTimestamp?: string;
  },
  namespaceName: string,
  config: EntityTranslationConfig,
): ObservabilityAlertsNotificationChannelEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ObservabilityAlertsNotificationChannel',
    metadata: {
      name: channel.name,
      namespace: namespaceName,
      title: channel.displayName || channel.name,
      description:
        channel.description || `${channel.name} notification channel`,
      tags: ['openchoreo', 'notification-channel', channel.type],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        ...(channel.createdAt && {
          [CHOREO_ANNOTATIONS.CREATED_AT]: channel.createdAt,
        }),
        ...(channel.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: channel.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      environment: channel.environment,
      isEnvDefault: channel.isEnvDefault,
      type: channel.type,
      ...(channel.emailConfig && { emailConfig: channel.emailConfig }),
      ...(channel.webhookConfig && { webhookConfig: channel.webhookConfig }),
    },
  };
}

/**
 * Translates an OpenChoreo ComponentType to a Backstage ComponentType entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateComponentTypeToEntity(
  ct: {
    name: string;
    displayName?: string;
    description?: string;
    workloadType?: string;
    allowedWorkflows?: Array<string | AllowedWorkflowRef>;
    allowedTraits?: Array<string | AllowedTraitRef>;
    createdAt?: string;
    deletionTimestamp?: string;
  },
  namespaceName: string,
  config: EntityTranslationConfig,
): ComponentTypeEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ComponentType',
    metadata: {
      name: ct.name,
      namespace: namespaceName,
      title: ct.displayName || ct.name,
      description: ct.description || `${ct.name} component type`,
      tags: [
        'openchoreo',
        'component-type',
        ...(ct.workloadType ? [ct.workloadType] : []),
        'platform-engineering',
      ],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.CREATED_AT]: ct.createdAt || '',
        ...(ct.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: ct.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      domain: `default/${namespaceName}`,
      workloadType: ct.workloadType,
      allowedWorkflows: normalizeAllowedWorkflows(
        ct.allowedWorkflows,
        'Workflow',
      ),
      allowedTraits: normalizeAllowedTraits(ct.allowedTraits, 'Trait'),
    },
  } as ComponentTypeEntityV1alpha1;
}

/**
 * Translates an OpenChoreo Workflow to a Backstage Workflow entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateWorkflowToEntity(
  wf: {
    name: string;
    displayName?: string;
    description?: string;
    createdAt?: string;
    parameters?: string;
    type?: string;
    deletionTimestamp?: string;
    workflowPlaneRef?: { kind?: string; name?: string };
    ttlAfterCompletion?: string;
  },
  namespaceName: string,
  config: EntityTranslationConfig,
): WorkflowEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Workflow',
    metadata: {
      name: wf.name,
      namespace: namespaceName,
      title: wf.displayName || wf.name,
      description: wf.description || `${wf.name} workflow`,
      tags: ['openchoreo', 'workflow', 'platform-engineering'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.CREATED_AT]: wf.createdAt || '',
        ...(wf.parameters && {
          [CHOREO_ANNOTATIONS.WORKFLOW_PARAMETERS]: wf.parameters,
        }),
        ...(wf.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: wf.deletionTimestamp,
        }),
        ...(wf.workflowPlaneRef?.name && {
          [CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF]: wf.workflowPlaneRef.name,
        }),
        ...(wf.workflowPlaneRef?.kind && {
          [CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF_KIND]:
            wf.workflowPlaneRef.kind,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      domain: `default/${namespaceName}`,
      ...(wf.type && { type: wf.type }),
      ...(wf.workflowPlaneRef?.name && {
        workflowPlaneRef: wf.workflowPlaneRef.name,
        workflowPlaneRefKind: wf.workflowPlaneRef.kind || 'WorkflowPlane',
      }),
      ...(wf.ttlAfterCompletion && {
        ttlAfterCompletion: wf.ttlAfterCompletion,
      }),
    },
  };
}

/**
 * Translates an OpenChoreo Trait to a Backstage TraitType entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateTraitToEntity(
  trait: {
    name: string;
    displayName?: string;
    description?: string;
    createdAt?: string;
    deletionTimestamp?: string;
  },
  namespaceName: string,
  config: EntityTranslationConfig,
): TraitTypeEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'TraitType',
    metadata: {
      name: trait.name,
      namespace: namespaceName,
      title: trait.displayName || trait.name,
      description: trait.description || `${trait.name} trait`,
      tags: ['openchoreo', 'trait-type', 'platform-engineering'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.CREATED_AT]: trait.createdAt || '',
        ...(trait.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: trait.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      domain: `default/${namespaceName}`,
    },
  };
}

/**
 * Translates an OpenChoreo ResourceType to a Backstage ResourceType entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateResourceTypeToEntity(
  rt: {
    name: string;
    displayName?: string;
    description?: string;
    retainPolicy?: string;
    createdAt?: string;
    deletionTimestamp?: string;
  },
  namespaceName: string,
  config: EntityTranslationConfig,
): ResourceTypeEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ResourceType',
    metadata: {
      name: rt.name,
      namespace: namespaceName,
      title: rt.displayName || rt.name,
      description: rt.description || `${rt.name} resource type`,
      tags: ['openchoreo', 'resource-type', 'platform-engineering'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.CREATED_AT]: rt.createdAt || '',
        ...(rt.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: rt.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      domain: `default/${namespaceName}`,
      retainPolicy:
        (rt.retainPolicy as 'Delete' | 'Retain' | undefined) ?? 'Delete',
    },
  } as ResourceTypeEntityV1alpha1;
}

/**
 * Configuration for Resource entity translation.
 */
export interface ResourceEntityTranslationConfig
  extends EntityTranslationConfig {
  /** Default owner ref used as `spec.owner` (required by the Backstage Resource kind). */
  defaultOwner: string;
}

/**
 * Translates an OpenChoreo Resource to a Backstage Resource entity.
 *
 * Resources are developer-facing managed-infrastructure dependencies
 * (databases, queues, caches, ...) that reference a (Cluster)ResourceType
 * template via `spec.type`. The bare type name lives in `spec.type`; the
 * template kind disambiguation lives in the `openchoreo.io/resource-type-kind`
 * annotation so catalog filters stay flat. `spec.system` links to the
 * owning Project, mirroring the Component precedent.
 */
export function translateResourceToEntity(
  resource: {
    name: string;
    uid?: string;
    displayName?: string;
    description?: string;
    projectName: string;
    typeName: string;
    typeKind: 'ResourceType' | 'ClusterResourceType';
    parameters?: Record<string, unknown>;
    createdAt?: string;
    deletionTimestamp?: string;
    status?: string;
  },
  namespaceName: string,
  config: ResourceEntityTranslationConfig,
): Entity {
  const hasParameters =
    resource.parameters &&
    typeof resource.parameters === 'object' &&
    Object.keys(resource.parameters).length > 0;

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Resource',
    metadata: {
      name: resource.name,
      namespace: namespaceName,
      title: resource.displayName || resource.name,
      description: resource.description || `${resource.name} resource`,
      tags: ['openchoreo', 'resource', resource.typeName],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.PROJECT]: resource.projectName,
        [CHOREO_ANNOTATIONS.RESOURCE]: resource.name,
        ...(resource.uid && {
          [CHOREO_ANNOTATIONS.RESOURCE_UID]: resource.uid,
        }),
        [CHOREO_ANNOTATIONS.RESOURCE_TYPE]: resource.typeName,
        [CHOREO_ANNOTATIONS.RESOURCE_TYPE_KIND]: resource.typeKind,
        [CHOREO_ANNOTATIONS.CREATED_AT]: resource.createdAt || '',
        ...(resource.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: resource.deletionTimestamp,
        }),
        ...(resource.status && {
          [CHOREO_ANNOTATIONS.STATUS]: resource.status,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      type: resource.typeName,
      owner: config.defaultOwner,
      system: resource.projectName,
      ...(hasParameters && { parameters: resource.parameters as any }),
    },
  };
}

/**
 * Configuration for namespace entity translation
 */
export interface NamespaceEntityTranslationConfig
  extends EntityTranslationConfig {
  defaultOwner: string;
}

/**
 * Translates an OpenChoreo Namespace to a Backstage Domain entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateNamespaceToDomainEntity(
  namespace: {
    name: string;
    displayName?: string;
    description?: string;
    createdAt?: string;
    status?: string;
  },
  config: NamespaceEntityTranslationConfig,
): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Domain',
    metadata: {
      name: namespace.name,
      title: namespace.displayName || namespace.name,
      description: namespace.description || namespace.name,
      tags: ['openchoreo', 'namespace', 'domain'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespace.name,
        ...(namespace.createdAt && {
          [CHOREO_ANNOTATIONS.CREATED_AT]: namespace.createdAt,
        }),
        ...(namespace.status && {
          [CHOREO_ANNOTATIONS.STATUS]: namespace.status,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      owner: config.defaultOwner,
    },
  };
}

/**
 * Translates an OpenChoreo ClusterComponentType to a Backstage ClusterComponentType entity.
 * Cluster-scoped: no namespace param, entity namespace is 'openchoreo-cluster', no domain.
 */
export function translateClusterComponentTypeToEntity(
  ct: {
    name: string;
    displayName?: string;
    description?: string;
    workloadType?: string;
    allowedWorkflows?: Array<string | AllowedWorkflowRef>;
    allowedTraits?: Array<string | AllowedTraitRef>;
    createdAt?: string;
    deletionTimestamp?: string;
  },
  config: EntityTranslationConfig,
): ClusterComponentTypeEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterComponentType',
    metadata: {
      name: ct.name,
      namespace: 'openchoreo-cluster',
      title: ct.displayName || ct.name,
      description: ct.description || `${ct.name} cluster component type`,
      tags: [
        'openchoreo',
        'cluster-component-type',
        ...(ct.workloadType ? [ct.workloadType] : []),
        'platform-engineering',
      ],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.CREATED_AT]: ct.createdAt || '',
        ...(ct.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: ct.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      workloadType: ct.workloadType || 'deployment',
      allowedWorkflows: normalizeAllowedWorkflows(
        ct.allowedWorkflows,
        'ClusterWorkflow',
      ),
      allowedTraits: normalizeAllowedTraits(ct.allowedTraits, 'ClusterTrait'),
    },
  } as ClusterComponentTypeEntityV1alpha1;
}

/**
 * Translates an OpenChoreo ClusterResourceType to a Backstage ClusterResourceType entity.
 * Cluster-scoped: no namespace param, entity namespace is 'openchoreo-cluster', no domain.
 */
export function translateClusterResourceTypeToEntity(
  crt: {
    name: string;
    displayName?: string;
    description?: string;
    retainPolicy?: string;
    createdAt?: string;
    deletionTimestamp?: string;
  },
  config: EntityTranslationConfig,
): ClusterResourceTypeEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterResourceType',
    metadata: {
      name: crt.name,
      namespace: 'openchoreo-cluster',
      title: crt.displayName || crt.name,
      description: crt.description || `${crt.name} cluster resource type`,
      tags: ['openchoreo', 'cluster-resource-type', 'platform-engineering'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.CREATED_AT]: crt.createdAt || '',
        ...(crt.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: crt.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      retainPolicy:
        (crt.retainPolicy as 'Delete' | 'Retain' | undefined) ?? 'Delete',
    },
  } as ClusterResourceTypeEntityV1alpha1;
}

/**
 * Translates an OpenChoreo ProjectType to a Backstage ProjectType entity.
 * Namespaced platform-engineer template; emits partOf Domain via spec.domain
 * (handled by ProjectTypeEntityProcessor), mirroring ResourceType.
 */
export function translateProjectTypeToEntity(
  pt: {
    name: string;
    displayName?: string;
    description?: string;
    createdAt?: string;
    deletionTimestamp?: string;
  },
  namespaceName: string,
  config: EntityTranslationConfig,
): ProjectTypeEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ProjectType',
    metadata: {
      name: pt.name,
      namespace: namespaceName,
      title: pt.displayName || pt.name,
      description: pt.description || `${pt.name} project type`,
      tags: ['openchoreo', 'project-type', 'platform-engineering'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.CREATED_AT]: pt.createdAt || '',
        ...(pt.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: pt.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      domain: `default/${namespaceName}`,
    },
  } as ProjectTypeEntityV1alpha1;
}

/**
 * Translates an OpenChoreo ClusterProjectType to a Backstage ClusterProjectType
 * entity. Cluster-scoped: no namespace param, entity namespace is
 * 'openchoreo-cluster', no domain.
 */
export function translateClusterProjectTypeToEntity(
  cpt: {
    name: string;
    displayName?: string;
    description?: string;
    createdAt?: string;
    deletionTimestamp?: string;
  },
  config: EntityTranslationConfig,
): ClusterProjectTypeEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterProjectType',
    metadata: {
      name: cpt.name,
      namespace: 'openchoreo-cluster',
      title: cpt.displayName || cpt.name,
      description: cpt.description || `${cpt.name} cluster project type`,
      tags: ['openchoreo', 'cluster-project-type', 'platform-engineering'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.CREATED_AT]: cpt.createdAt || '',
        ...(cpt.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: cpt.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {},
  } as ClusterProjectTypeEntityV1alpha1;
}

/**
 * Translates an OpenChoreo ClusterTrait to a Backstage ClusterTraitType entity.
 * Cluster-scoped: no namespace param, entity namespace is 'openchoreo-cluster', no domain.
 */
export function translateClusterTraitToEntity(
  trait: {
    name: string;
    displayName?: string;
    description?: string;
    createdAt?: string;
    deletionTimestamp?: string;
  },
  config: EntityTranslationConfig,
): ClusterTraitTypeEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterTraitType',
    metadata: {
      name: trait.name,
      namespace: 'openchoreo-cluster',
      title: trait.displayName || trait.name,
      description: trait.description || `${trait.name} cluster trait`,
      tags: ['openchoreo', 'cluster-trait-type', 'platform-engineering'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.CREATED_AT]: trait.createdAt || '',
        ...(trait.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: trait.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {},
  };
}

/**
 * Translates an OpenChoreo DeploymentPipeline to a Backstage DeploymentPipeline entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateDeploymentPipelineToEntity(
  pipeline: {
    name: string;
    displayName?: string;
    description?: string;
    uid?: string;
    createdAt?: string;
    status?: string;
    deletionTimestamp?: string;
    promotionPaths?: Array<{
      sourceEnvironment: string;
      targetEnvironments: Array<{
        name: string;
        requiresApproval?: boolean;
        isManualApprovalRequired?: boolean;
      }>;
    }>;
  },
  namespaceName: string,
  config: EntityTranslationConfig,
): DeploymentPipelineEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'DeploymentPipeline',
    metadata: {
      name: pipeline.name,
      namespace: namespaceName,
      title: pipeline.displayName || pipeline.name,
      description:
        pipeline.description || `Deployment pipeline ${pipeline.name}`,
      tags: ['openchoreo', 'deployment-pipeline', 'platform-engineering'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.CREATED_AT]: pipeline.createdAt || '',
        ...(pipeline.status && {
          [CHOREO_ANNOTATIONS.STATUS]: pipeline.status,
        }),
        ...(pipeline.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: pipeline.deletionTimestamp,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
        'openchoreo.io/deployment-pipeline': 'true',
      },
    },
    spec: {
      namespaceName,
      domain: `default/${namespaceName}`,
      promotionPaths: pipeline.promotionPaths || [],
    },
  };
}

/**
 * Translates an OpenChoreo ClusterWorkflow to a Backstage ClusterWorkflow entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateClusterWorkflowToEntity(
  wf: {
    name: string;
    displayName?: string;
    description?: string;
    createdAt?: string;
    parameters?: string;
    type?: string;
    deletionTimestamp?: string;
    workflowPlaneRef?: { kind?: string; name?: string };
    ttlAfterCompletion?: string;
  },
  config: EntityTranslationConfig,
): ClusterWorkflowEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterWorkflow',
    metadata: {
      name: wf.name,
      namespace: 'openchoreo-cluster',
      title: wf.displayName || wf.name,
      description: wf.description || `${wf.name} cluster workflow`,
      tags: ['openchoreo', 'cluster-workflow', 'platform-engineering'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.CREATED_AT]: wf.createdAt || '',
        ...(wf.parameters && {
          [CHOREO_ANNOTATIONS.WORKFLOW_PARAMETERS]: wf.parameters,
        }),
        ...(wf.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: wf.deletionTimestamp,
        }),
        ...(wf.workflowPlaneRef?.name && {
          [CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF]: wf.workflowPlaneRef.name,
        }),
        ...(wf.workflowPlaneRef?.kind && {
          [CHOREO_ANNOTATIONS.WORKFLOW_PLANE_REF_KIND]:
            wf.workflowPlaneRef.kind,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      ...(wf.type && { type: wf.type }),
      ...(wf.workflowPlaneRef?.name && {
        workflowPlaneRef: wf.workflowPlaneRef.name,
        workflowPlaneRefKind:
          wf.workflowPlaneRef.kind || 'ClusterWorkflowPlane',
      }),
      ...(wf.ttlAfterCompletion && {
        ttlAfterCompletion: wf.ttlAfterCompletion,
      }),
    },
  };
}

// ───────────────────────────────────────────────────────────────────────
// New-API adapter functions
//
// These take an OpenChoreo CR (the "new" API shape) and return a Backstage
// Entity. They wrap the lower-level translateXxxToEntity functions above
// and own the small amount of shape-adapting needed (converting CR
// fields to the legacy-shaped translator inputs). Both the periodic
// full sync and the per-event delta path call these so the two paths
// always emit identical entity content.
// ───────────────────────────────────────────────────────────────────────

/**
 * Context shared by every New-API adapter that needs the provider's
 * identity, default owner, or the runtime ComponentType utilities.
 */
export interface NewApiTranslatorContext {
  /** Output of `provider.getProviderName()` (e.g. `OpenChoreoEntityProvider`). */
  providerName: string;
  /** Default owner ref (`group:default/openchoreo-users` etc.) used when no annotation is present. */
  defaultOwner: string;
  /** Runtime utilities for resolving componentType references (built from config). */
  componentTypeUtils: ComponentTypeUtils;
}

function managedAnnotations(providerName: string): {
  'backstage.io/managed-by-location': string;
  'backstage.io/managed-by-origin-location': string;
} {
  return {
    'backstage.io/managed-by-location': `provider:${providerName}`,
    'backstage.io/managed-by-origin-location': `provider:${providerName}`,
  };
}

/**
 * Maps new-API agent connection status to Backstage entity annotations.
 */
function mapAgentConnectionAnnotations(
  agentConnection?: NewAgentConnectionStatus,
): Record<string, string> {
  if (!agentConnection) return {};

  const annotations: Record<string, string> = {
    [CHOREO_ANNOTATIONS.AGENT_CONNECTED]:
      agentConnection.connected?.toString() || 'false',
    [CHOREO_ANNOTATIONS.AGENT_CONNECTED_COUNT]:
      agentConnection.connectedAgents?.toString() || '0',
  };

  if (agentConnection.lastConnectedTime) {
    annotations[CHOREO_ANNOTATIONS.AGENT_LAST_CONNECTED] =
      agentConnection.lastConnectedTime;
  }

  return annotations;
}

// `normalizeObservabilityPlaneRef` is shared with helpers.ts — see
// `../utils/helpers.ts` for the canonical implementation.

/**
 * Translates a new API Namespace into a Backstage Domain entity.
 */
export function translateNewNamespaceToDomainEntity(
  namespace: NewNamespace,
  ctx: NewApiTranslatorContext,
): Entity {
  const name = getName(namespace);
  const displayName = getDisplayName(namespace);
  const description = getDescription(namespace);
  const createdAt = getCreatedAt(namespace);
  const status = namespace.status?.phase;

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Domain',
    metadata: {
      name: name!,
      title: displayName || name!,
      description: description || name!,
      tags: ['openchoreo', 'namespace', 'domain'],
      annotations: {
        ...managedAnnotations(ctx.providerName),
        [CHOREO_ANNOTATIONS.NAMESPACE]: name!,
        ...(createdAt && { [CHOREO_ANNOTATIONS.CREATED_AT]: createdAt }),
        ...(status && { [CHOREO_ANNOTATIONS.STATUS]: status }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      owner: ctx.defaultOwner,
    },
  };
}

/**
 * Translates a new-API Project into a Backstage System entity.
 */
export function translateNewProjectToEntity(
  project: NewProject,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): Entity {
  return translateProjectToEntity(
    {
      name: getName(project)!,
      displayName: getDisplayName(project),
      description: getDescription(project),
      namespaceName: getNamespace(project) ?? namespaceName,
      uid: getUid(project),
      deletionTimestamp: getDeletionTimestamp(project),
      deploymentPipelineRef: project.spec?.deploymentPipelineRef?.name,
      projectTypeName: project.spec?.type?.name,
      projectTypeKind: project.spec?.type?.kind as
        | 'ProjectType'
        | 'ClusterProjectType'
        | undefined,
    },
    namespaceName,
    {
      locationKey: ctx.providerName,
      defaultOwner: resolveProjectOwner(project, ctx.defaultOwner),
    },
  );
}

/**
 * Translates a new-API Component into a Backstage Component entity.
 *
 * `providesApis` and `consumesApis` are computed by the caller (using
 * `helpers.resolveProvidesAndConsumes`) and passed in here unchanged.
 */
export function translateNewComponentToEntity(
  component: NewComponent,
  namespaceName: string,
  projectName: string,
  owner: string,
  ctx: NewApiTranslatorContext,
  providesApis?: string[],
  consumesApis?: string[],
  /**
   * The current owning Workload's `metadata.name`, if a Workload is
   * paired with this Component at translation time. Stamped onto the
   * resulting Component entity as `openchoreo.io/workload` so the
   * workload-deletion handler can locate the parent Component via a
   * catalog annotation query. Omit if no Workload exists yet for this
   * Component (the annotation simply isn't set, and the next refresh
   * after a Workload is created will add it).
   */
  workloadName?: string,
  /**
   * Backstage entity refs populated into `spec.dependsOn` so Backstage's
   * built-in processor emits the Component → target `dependsOn` relation.
   * Resource refs use the form `resource:<namespace>/<name>`.
   */
  dependsOn?: string[],
): Entity {
  const componentName = getName(component)!;
  const componentTypeRef = component.spec?.componentType;
  const componentType =
    typeof componentTypeRef === 'string'
      ? componentTypeRef
      : componentTypeRef?.name ?? '';

  const entity = translateComponentToEntity(
    {
      name: componentName,
      displayName: getDisplayName(component),
      uid: getUid(component),
      type: componentType,
      componentType:
        typeof componentTypeRef === 'object' && componentTypeRef
          ? { kind: componentTypeRef.kind, name: componentTypeRef.name }
          : undefined,
      status: isReady(component) ? 'Ready' : 'Not Ready',
      createdAt: getCreatedAt(component),
      description: getDescription(component),
      deletionTimestamp: getDeletionTimestamp(component),
      componentWorkflow: component.spec?.workflow
        ? {
            name: component.spec.workflow.name ?? '',
            parameters: component.spec.workflow.parameters,
          }
        : undefined,
    } as ModelsComponent,
    namespaceName,
    projectName,
    {
      defaultOwner: owner,
      componentTypeUtils: ctx.componentTypeUtils,
      locationKey: `provider:${ctx.providerName}`,
    },
    providesApis,
    consumesApis,
    dependsOn,
  );

  if (workloadName) {
    entity.metadata.annotations = {
      ...(entity.metadata.annotations ?? {}),
      [CHOREO_ANNOTATIONS.WORKLOAD]: workloadName,
    };
  }
  return entity;
}

/**
 * Translates a new-API Environment into a Backstage Environment entity.
 */
export function translateNewEnvironmentToEntity(
  env: NewEnvironment,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): EnvironmentEntityV1alpha1 {
  const ingress = env.spec?.gateway?.ingress;
  return translateEnvironmentToEntity(
    {
      name: getName(env)!,
      displayName: getDisplayName(env),
      description: getDescription(env),
      uid: getUid(env),
      isProduction: env.spec?.isProduction,
      dataPlaneRef: env.spec?.dataPlaneRef
        ? {
            kind: env.spec.dataPlaneRef.kind,
            name: env.spec.dataPlaneRef.name,
          }
        : undefined,
      dnsPrefix: ingress?.external?.http?.host,
      gateway: ingress
        ? {
            ingress: {
              external: ingress.external
                ? {
                    name: ingress.external.name,
                    namespace: ingress.external.namespace,
                    http: ingress.external.http
                      ? {
                          host: ingress.external.http.host,
                          port: ingress.external.http.port,
                        }
                      : undefined,
                    https: ingress.external.https
                      ? {
                          host: ingress.external.https.host,
                          port: ingress.external.https.port,
                        }
                      : undefined,
                  }
                : undefined,
              internal: ingress.internal
                ? {
                    name: ingress.internal.name,
                    namespace: ingress.internal.namespace,
                    http: ingress.internal.http
                      ? {
                          host: ingress.internal.http.host,
                          port: ingress.internal.http.port,
                        }
                      : undefined,
                    https: ingress.internal.https
                      ? {
                          host: ingress.internal.https.host,
                          port: ingress.internal.https.port,
                        }
                      : undefined,
                  }
                : undefined,
            },
          }
        : undefined,
      createdAt: getCreatedAt(env),
      status: isReady(env) ? 'Ready' : 'Not Ready',
      deletionTimestamp: getDeletionTimestamp(env),
    },
    namespaceName,
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API ObservabilityAlertsNotificationChannel into a
 * Backstage ObservabilityAlertsNotificationChannel entity.
 */
export function translateNewNotificationChannelToEntity(
  channel: NewNotificationChannel,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): ObservabilityAlertsNotificationChannelEntityV1alpha1 {
  return translateNotificationChannelToEntity(
    {
      name: getName(channel)!,
      displayName: getDisplayName(channel),
      description: getDescription(channel),
      environment: channel.spec?.environment ?? '',
      isEnvDefault: channel.spec?.isEnvDefault,
      type: channel.spec?.type as 'email' | 'webhook',
      emailConfig: channel.spec?.emailConfig,
      webhookConfig: channel.spec?.webhookConfig,
      createdAt: getCreatedAt(channel),
      deletionTimestamp: getDeletionTimestamp(channel),
    },
    namespaceName,
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API DataPlane into a Backstage Dataplane entity.
 */
export function translateNewDataplaneToEntity(
  dp: NewDataPlane,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): DataplaneEntityV1alpha1 {
  const dpName = getName(dp)!;
  const ingress = dp.spec?.gateway?.ingress;
  const obsPlaneRef = dp.spec?.observabilityPlaneRef;
  const normalizedObsRef = normalizeObservabilityPlaneRef(
    obsPlaneRef?.name,
    namespaceName,
  );

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Dataplane',
    metadata: {
      name: dpName,
      namespace: namespaceName,
      title: getDisplayName(dp) || dpName,
      description: getDescription(dp) || `${dpName} dataplane`,
      tags: ['openchoreo', 'dataplane', 'infrastructure'],
      annotations: {
        ...managedAnnotations(ctx.providerName),
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(dp) || '',
        [CHOREO_ANNOTATIONS.STATUS]: isCreated(dp) ? 'Ready' : 'Not Ready',
        [CHOREO_ANNOTATIONS.OBSERVABILITY_PLANE_REF]: normalizedObsRef,
        ...mapAgentConnectionAnnotations(dp.status?.agentConnection),
        ...(getDeletionTimestamp(dp) && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: getDeletionTimestamp(dp)!,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
        'openchoreo.io/dataplane': 'true',
      },
    },
    spec: {
      domain: `default/${namespaceName}`,
      gateway: ingress
        ? {
            ingress: {
              external: ingress.external
                ? {
                    name: ingress.external.name,
                    namespace: ingress.external.namespace,
                    http: ingress.external.http
                      ? {
                          host: ingress.external.http.host,
                          port: ingress.external.http.port,
                        }
                      : undefined,
                    https: ingress.external.https
                      ? {
                          host: ingress.external.https.host,
                          port: ingress.external.https.port,
                        }
                      : undefined,
                  }
                : undefined,
              internal: ingress.internal
                ? {
                    name: ingress.internal.name,
                    namespace: ingress.internal.namespace,
                    http: ingress.internal.http
                      ? {
                          host: ingress.internal.http.host,
                          port: ingress.internal.http.port,
                        }
                      : undefined,
                    https: ingress.internal.https
                      ? {
                          host: ingress.internal.https.host,
                          port: ingress.internal.https.port,
                        }
                      : undefined,
                  }
                : undefined,
            },
          }
        : undefined,
      observabilityPlaneRef: normalizedObsRef,
    },
  };
}

/**
 * Translates a new-API WorkflowPlane into a Backstage WorkflowPlane entity.
 */
export function translateNewWorkflowPlaneToEntity(
  bp: NewWorkflowPlane,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): WorkflowPlaneEntityV1alpha1 {
  const bpName = getName(bp)!;
  const obsPlaneRef = bp.spec?.observabilityPlaneRef;
  const normalizedObsRef = normalizeObservabilityPlaneRef(
    obsPlaneRef?.name,
    namespaceName,
  );

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'WorkflowPlane',
    metadata: {
      name: bpName,
      namespace: namespaceName,
      title: getDisplayName(bp) || bpName,
      description: getDescription(bp) || `${bpName} workflow plane`,
      tags: ['openchoreo', 'workflowplane', 'infrastructure'],
      annotations: {
        ...managedAnnotations(ctx.providerName),
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(bp) || '',
        [CHOREO_ANNOTATIONS.STATUS]: isCreated(bp) ? 'Ready' : 'Not Ready',
        [CHOREO_ANNOTATIONS.OBSERVABILITY_PLANE_REF]: normalizedObsRef,
        ...mapAgentConnectionAnnotations(bp.status?.agentConnection),
        ...(getDeletionTimestamp(bp) && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: getDeletionTimestamp(bp)!,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
        'openchoreo.io/workflowplane': 'true',
      },
    },
    spec: {
      domain: `default/${namespaceName}`,
      observabilityPlaneRef: normalizedObsRef,
    },
  };
}

/**
 * Translates a new-API ObservabilityPlane into a Backstage
 * ObservabilityPlane entity.
 */
export function translateNewObservabilityPlaneToEntity(
  op: NewObservabilityPlane,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): ObservabilityPlaneEntityV1alpha1 {
  const opName = getName(op)!;

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ObservabilityPlane',
    metadata: {
      name: opName,
      namespace: namespaceName,
      title: getDisplayName(op) || opName,
      description: getDescription(op) || `${opName} observability plane`,
      tags: ['openchoreo', 'observabilityplane', 'infrastructure'],
      annotations: {
        ...managedAnnotations(ctx.providerName),
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(op) || '',
        [CHOREO_ANNOTATIONS.STATUS]: isCreated(op) ? 'Ready' : 'Not Ready',
        ...(op.spec?.observerURL && {
          [CHOREO_ANNOTATIONS.OBSERVER_URL]: op.spec.observerURL,
        }),
        ...mapAgentConnectionAnnotations(op.status?.agentConnection),
        ...(getDeletionTimestamp(op) && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: getDeletionTimestamp(op)!,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
        'openchoreo.io/observabilityplane': 'true',
      },
    },
    spec: {
      domain: `default/${namespaceName}`,
      observerURL: op.spec?.observerURL,
    },
  };
}

/**
 * Translates a new-API DeploymentPipeline into a Backstage
 * DeploymentPipeline entity.
 *
 * The Project↔DeploymentPipeline relation pair is now emitted by
 * `SystemEntityProcessor` from each Project entity that references this
 * pipeline. The DP entity therefore no longer carries a `projectRefs`
 * field — it is a faithful translation of the DP CR.
 */
export function translateNewDeploymentPipelineToEntity(
  pipeline: NewDeploymentPipeline,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): DeploymentPipelineEntityV1alpha1 {
  const pipelineName = getName(pipeline)!;

  const promotionPaths =
    pipeline.spec?.promotionPaths?.map(path => ({
      sourceEnvironment:
        typeof path.sourceEnvironmentRef === 'string'
          ? path.sourceEnvironmentRef
          : (path.sourceEnvironmentRef as unknown as { name: string })?.name ??
            '',
      targetEnvironments:
        path.targetEnvironmentRefs?.map(target => ({
          name: target.name,
        })) || [],
    })) || [];

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'DeploymentPipeline',
    metadata: {
      name: pipelineName,
      namespace: namespaceName,
      title: getDisplayName(pipeline) || pipelineName,
      description:
        getDescription(pipeline) || `Deployment pipeline ${pipelineName}`,
      tags: ['openchoreo', 'deployment-pipeline', 'platform-engineering'],
      annotations: {
        ...managedAnnotations(ctx.providerName),
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        ...(getCreatedAt(pipeline) && {
          [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(pipeline)!,
        }),
        [CHOREO_ANNOTATIONS.STATUS]: isReady(pipeline) ? 'Ready' : 'Not Ready',
        ...(getDeletionTimestamp(pipeline) && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]:
            getDeletionTimestamp(pipeline)!,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
        'openchoreo.io/deployment-pipeline': 'true',
      },
    },
    spec: {
      namespaceName: namespaceName,
      domain: `default/${namespaceName}`,
      promotionPaths,
    },
  };
}

/**
 * Translates a new-API ComponentType into a Backstage ComponentType entity.
 */
export function translateNewComponentTypeToEntity(
  ct: NewComponentType,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): ComponentTypeEntityV1alpha1 {
  return translateComponentTypeToEntity(
    {
      name: getName(ct)!,
      displayName: getDisplayName(ct),
      description: getDescription(ct),
      workloadType: ct.spec?.workloadType,
      allowedWorkflows: ct.spec?.allowedWorkflows,
      allowedTraits: ct.spec?.allowedTraits,
      createdAt: getCreatedAt(ct),
      deletionTimestamp: getDeletionTimestamp(ct),
    },
    namespaceName,
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API Trait into a Backstage TraitType entity.
 */
export function translateNewTraitToEntity(
  trait: NewTrait,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): TraitTypeEntityV1alpha1 {
  return translateTraitToEntity(
    {
      name: getName(trait)!,
      displayName: getDisplayName(trait),
      description: getDescription(trait),
      createdAt: getCreatedAt(trait),
      deletionTimestamp: getDeletionTimestamp(trait),
    },
    namespaceName,
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API Workflow into a Backstage Workflow entity.
 */
export function translateNewWorkflowToEntity(
  wf: NewWorkflow,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): WorkflowEntityV1alpha1 {
  const isCI =
    wf.metadata?.labels?.['openchoreo.dev/workflow-type'] === 'component';
  const wpRef = (wf as any).spec?.workflowPlaneRef;
  const ttl = (wf as any).spec?.ttlAfterCompletion;
  return translateWorkflowToEntity(
    {
      name: getName(wf)!,
      displayName: getDisplayName(wf),
      description: getDescription(wf),
      createdAt: getCreatedAt(wf),
      parameters: extractWorkflowParameters((wf as any).spec),
      type: isCI ? 'CI' : 'Generic',
      deletionTimestamp: getDeletionTimestamp(wf),
      ...(wpRef && {
        workflowPlaneRef: { kind: wpRef.kind, name: wpRef.name },
      }),
      ...(ttl && { ttlAfterCompletion: ttl }),
    },
    namespaceName,
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API ClusterComponentType into a Backstage
 * ClusterComponentType entity.
 */
export function translateNewClusterComponentTypeToEntity(
  cct: NewClusterComponentType,
  ctx: NewApiTranslatorContext,
): ClusterComponentTypeEntityV1alpha1 {
  return translateClusterComponentTypeToEntity(
    {
      name: getName(cct)!,
      displayName: getDisplayName(cct),
      description: getDescription(cct),
      workloadType: cct.spec?.workloadType,
      allowedWorkflows: cct.spec?.allowedWorkflows,
      allowedTraits: cct.spec?.allowedTraits,
      createdAt: getCreatedAt(cct),
      deletionTimestamp: getDeletionTimestamp(cct),
    },
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API ClusterResourceType into a Backstage
 * ClusterResourceType entity.
 */
export function translateNewClusterResourceTypeToEntity(
  crt: NewClusterResourceType,
  ctx: NewApiTranslatorContext,
): ClusterResourceTypeEntityV1alpha1 {
  return translateClusterResourceTypeToEntity(
    {
      name: getName(crt)!,
      displayName: getDisplayName(crt),
      description: getDescription(crt),
      retainPolicy: crt.spec?.retainPolicy,
      createdAt: getCreatedAt(crt),
      deletionTimestamp: getDeletionTimestamp(crt),
    },
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API ResourceType into a Backstage ResourceType entity.
 */
export function translateNewResourceTypeToEntity(
  rt: NewResourceType,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): ResourceTypeEntityV1alpha1 {
  return translateResourceTypeToEntity(
    {
      name: getName(rt)!,
      displayName: getDisplayName(rt),
      description: getDescription(rt),
      retainPolicy: rt.spec?.retainPolicy,
      createdAt: getCreatedAt(rt),
      deletionTimestamp: getDeletionTimestamp(rt),
    },
    namespaceName,
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API ClusterProjectType into a Backstage ClusterProjectType
 * entity.
 */
export function translateNewClusterProjectTypeToEntity(
  cpt: NewClusterProjectType,
  ctx: NewApiTranslatorContext,
): ClusterProjectTypeEntityV1alpha1 {
  return translateClusterProjectTypeToEntity(
    {
      name: getName(cpt)!,
      displayName: getDisplayName(cpt),
      description: getDescription(cpt),
      createdAt: getCreatedAt(cpt),
      deletionTimestamp: getDeletionTimestamp(cpt),
    },
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API ProjectType into a Backstage ProjectType entity.
 */
export function translateNewProjectTypeToEntity(
  pt: NewProjectType,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): ProjectTypeEntityV1alpha1 {
  return translateProjectTypeToEntity(
    {
      name: getName(pt)!,
      displayName: getDisplayName(pt),
      description: getDescription(pt),
      createdAt: getCreatedAt(pt),
      deletionTimestamp: getDeletionTimestamp(pt),
    },
    namespaceName,
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API Resource (typed-client `ResourceInstance` shape;
 * on-the-wire `kind` is `Resource`) into a Backstage Resource entity.
 */
export function translateNewResourceToEntity(
  resource: NewResource,
  namespaceName: string,
  ctx: NewApiTranslatorContext,
): Entity {
  const spec = resource.spec;
  const typeKind =
    (spec?.type?.kind as 'ResourceType' | 'ClusterResourceType' | undefined) ??
    'ResourceType';
  return translateResourceToEntity(
    {
      name: getName(resource)!,
      uid: getUid(resource),
      displayName: getDisplayName(resource),
      description: getDescription(resource),
      projectName: spec?.owner?.projectName ?? '',
      typeName: spec?.type?.name ?? '',
      typeKind,
      parameters: spec?.parameters as Record<string, unknown> | undefined,
      createdAt: getCreatedAt(resource),
      deletionTimestamp: getDeletionTimestamp(resource),
    },
    namespaceName,
    { locationKey: ctx.providerName, defaultOwner: ctx.defaultOwner },
  );
}

/**
 * Translates a new-API ClusterTrait into a Backstage ClusterTraitType entity.
 */
export function translateNewClusterTraitToEntity(
  ct: NewClusterTrait,
  ctx: NewApiTranslatorContext,
): ClusterTraitTypeEntityV1alpha1 {
  return translateClusterTraitToEntity(
    {
      name: getName(ct)!,
      displayName: getDisplayName(ct),
      description: getDescription(ct),
      createdAt: getCreatedAt(ct),
      deletionTimestamp: getDeletionTimestamp(ct),
    },
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API ClusterWorkflow into a Backstage ClusterWorkflow entity.
 */
export function translateNewClusterWorkflowToEntity(
  cwf: NewClusterWorkflow,
  ctx: NewApiTranslatorContext,
): ClusterWorkflowEntityV1alpha1 {
  const isCI =
    cwf.metadata?.labels?.['openchoreo.dev/workflow-type'] === 'component';
  const wpRef = (cwf as any).spec?.workflowPlaneRef;
  const ttl = (cwf as any).spec?.ttlAfterCompletion;
  return translateClusterWorkflowToEntity(
    {
      name: getName(cwf)!,
      displayName: getDisplayName(cwf),
      description: getDescription(cwf),
      createdAt: getCreatedAt(cwf),
      parameters: extractWorkflowParameters((cwf as any).spec),
      type: isCI ? 'CI' : 'Generic',
      deletionTimestamp: getDeletionTimestamp(cwf),
      ...(wpRef && {
        workflowPlaneRef: { kind: wpRef.kind, name: wpRef.name },
      }),
      ...(ttl && { ttlAfterCompletion: ttl }),
    },
    { locationKey: ctx.providerName },
  );
}

/**
 * Translates a new-API ClusterDataPlane into a Backstage ClusterDataplane entity.
 */
export function translateNewClusterDataplaneToEntity(
  cdp: NewClusterDataPlane,
  ctx: NewApiTranslatorContext,
): ClusterDataplaneEntityV1alpha1 {
  const cdpName = getName(cdp)!;
  const ingress = cdp.spec?.gateway?.ingress;
  const obsPlaneRef = cdp.spec?.observabilityPlaneRef;
  const obsRefName = obsPlaneRef?.name;

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterDataplane',
    metadata: {
      name: cdpName,
      namespace: 'openchoreo-cluster',
      title: getDisplayName(cdp) || cdpName,
      description: getDescription(cdp) || `${cdpName} cluster data plane`,
      tags: ['openchoreo', 'cluster-dataplane', 'infrastructure'],
      annotations: {
        ...managedAnnotations(ctx.providerName),
        [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(cdp) || '',
        [CHOREO_ANNOTATIONS.STATUS]: isCreated(cdp) ? 'Ready' : 'Not Ready',
        ...(obsRefName && {
          [CHOREO_ANNOTATIONS.OBSERVABILITY_PLANE_REF]: obsRefName,
        }),
        ...mapAgentConnectionAnnotations(cdp.status?.agentConnection),
        ...(getDeletionTimestamp(cdp) && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: getDeletionTimestamp(cdp)!,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
        'openchoreo.io/cluster-dataplane': 'true',
      },
    },
    spec: {
      gateway: ingress
        ? {
            ingress: {
              external: ingress.external
                ? {
                    name: ingress.external.name,
                    namespace: ingress.external.namespace,
                    http: ingress.external.http
                      ? {
                          host: ingress.external.http.host,
                          port: ingress.external.http.port,
                        }
                      : undefined,
                    https: ingress.external.https
                      ? {
                          host: ingress.external.https.host,
                          port: ingress.external.https.port,
                        }
                      : undefined,
                  }
                : undefined,
              internal: ingress.internal
                ? {
                    name: ingress.internal.name,
                    namespace: ingress.internal.namespace,
                    http: ingress.internal.http
                      ? {
                          host: ingress.internal.http.host,
                          port: ingress.internal.http.port,
                        }
                      : undefined,
                    https: ingress.internal.https
                      ? {
                          host: ingress.internal.https.host,
                          port: ingress.internal.https.port,
                        }
                      : undefined,
                  }
                : undefined,
            },
          }
        : undefined,
      observabilityPlaneRef: obsRefName,
    },
  };
}

/**
 * Translates a new-API ClusterObservabilityPlane into a Backstage
 * ClusterObservabilityPlane entity.
 */
export function translateNewClusterObservabilityPlaneToEntity(
  cop: NewClusterObservabilityPlane,
  ctx: NewApiTranslatorContext,
): ClusterObservabilityPlaneEntityV1alpha1 {
  const copName = getName(cop)!;

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterObservabilityPlane',
    metadata: {
      name: copName,
      namespace: 'openchoreo-cluster',
      title: getDisplayName(cop) || copName,
      description:
        getDescription(cop) || `${copName} cluster observability plane`,
      tags: ['openchoreo', 'cluster-observabilityplane', 'infrastructure'],
      annotations: {
        ...managedAnnotations(ctx.providerName),
        [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(cop) || '',
        [CHOREO_ANNOTATIONS.STATUS]: isCreated(cop) ? 'Ready' : 'Not Ready',
        ...(cop.spec?.observerURL && {
          [CHOREO_ANNOTATIONS.OBSERVER_URL]: cop.spec.observerURL,
        }),
        ...mapAgentConnectionAnnotations(cop.status?.agentConnection),
        ...(getDeletionTimestamp(cop) && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: getDeletionTimestamp(cop)!,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
        'openchoreo.io/cluster-observabilityplane': 'true',
      },
    },
    spec: {
      observerURL: cop.spec?.observerURL,
    },
  };
}

/**
 * Translates a new-API ClusterWorkflowPlane into a Backstage
 * ClusterWorkflowPlane entity.
 */
export function translateNewClusterWorkflowPlaneToEntity(
  cbp: NewClusterWorkflowPlane,
  ctx: NewApiTranslatorContext,
): ClusterWorkflowPlaneEntityV1alpha1 {
  const cbpName = getName(cbp)!;
  const obsPlaneRef = cbp.spec?.observabilityPlaneRef;
  const obsRefName = obsPlaneRef?.name;

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ClusterWorkflowPlane',
    metadata: {
      name: cbpName,
      namespace: 'openchoreo-cluster',
      title: getDisplayName(cbp) || cbpName,
      description: getDescription(cbp) || `${cbpName} cluster workflow plane`,
      tags: ['openchoreo', 'cluster-workflowplane', 'infrastructure'],
      annotations: {
        ...managedAnnotations(ctx.providerName),
        [CHOREO_ANNOTATIONS.CREATED_AT]: getCreatedAt(cbp) || '',
        [CHOREO_ANNOTATIONS.STATUS]: isCreated(cbp) ? 'Ready' : 'Not Ready',
        ...(obsRefName && {
          [CHOREO_ANNOTATIONS.OBSERVABILITY_PLANE_REF]: obsRefName,
        }),
        ...mapAgentConnectionAnnotations(cbp.status?.agentConnection),
        ...(getDeletionTimestamp(cbp) && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: getDeletionTimestamp(cbp)!,
        }),
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
        'openchoreo.io/cluster-workflowplane': 'true',
      },
    },
    spec: {
      observabilityPlaneRef: obsRefName,
    },
  };
}
