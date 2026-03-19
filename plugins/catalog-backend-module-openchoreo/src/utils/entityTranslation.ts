import { Entity } from '@backstage/catalog-model';
import {
  CHOREO_ANNOTATIONS,
  CHOREO_LABELS,
  getRepositoryInfo,
  ComponentTypeUtils,
  type ComponentResponse,
} from '@openchoreo/backstage-plugin-common';
import type {
  EnvironmentEntityV1alpha1,
  ComponentTypeEntityV1alpha1,
  TraitTypeEntityV1alpha1,
  WorkflowEntityV1alpha1,
  ComponentWorkflowEntityV1alpha1,
  ClusterComponentTypeEntityV1alpha1,
  ClusterTraitTypeEntityV1alpha1,
  ClusterWorkflowEntityV1alpha1,
  DeploymentPipelineEntityV1alpha1,
} from '../kinds';

type ModelsComponent = ComponentResponse;
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
 * Translates an OpenChoreo ComponentWorkflow to a Backstage ComponentWorkflow entity.
 * Shared utility used by both scheduled sync and immediate insertion.
 */
export function translateComponentWorkflowToEntity(
  cw: {
    name: string;
    displayName?: string;
    description?: string;
    createdAt?: string;
    deletionTimestamp?: string;
  },
  namespaceName: string,
  config: EntityTranslationConfig,
): ComponentWorkflowEntityV1alpha1 {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'ComponentWorkflow',
    metadata: {
      name: cw.name,
      namespace: namespaceName,
      title: cw.displayName || cw.name,
      description: cw.description || `${cw.name} component workflow`,
      tags: ['openchoreo', 'component-workflow', 'platform-engineering'],
      annotations: {
        'backstage.io/managed-by-location': `provider:${config.locationKey}`,
        'backstage.io/managed-by-origin-location': `provider:${config.locationKey}`,
        [CHOREO_ANNOTATIONS.NAMESPACE]: namespaceName,
        [CHOREO_ANNOTATIONS.CREATED_AT]: cw.createdAt || '',
        ...(cw.deletionTimestamp && {
          [CHOREO_ANNOTATIONS.DELETION_TIMESTAMP]: cw.deletionTimestamp,
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
    projectRefs?: string[];
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
      projectRefs: pipeline.projectRefs || [],
      namespaceName,
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
