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
} from '../kinds';

type ModelsComponent = ComponentResponse;

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
): Entity {
  const componentEntity: Entity = {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name: component.name,
      title: component.name,
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
    buildPlaneRef?: { kind?: string; name?: string };
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
        ...(project.buildPlaneRef?.name && {
          [CHOREO_ANNOTATIONS.BUILD_PLANE_REF]: project.buildPlaneRef.name,
        }),
        ...(project.buildPlaneRef?.kind && {
          [CHOREO_ANNOTATIONS.BUILD_PLANE_REF_KIND]: project.buildPlaneRef.kind,
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
    createdAt?: string;
    status?: string;
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
    allowedWorkflows?: string[];
    allowedTraits?: Array<{ kind?: string; name: string }>;
    createdAt?: string;
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
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      domain: `default/${namespaceName}`,
      workloadType: ct.workloadType,
      allowedWorkflows: ct.allowedWorkflows,
      allowedTraits: ct.allowedTraits,
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
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      domain: `default/${namespaceName}`,
      ...(wf.type && { type: wf.type }),
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
    allowedWorkflows?: string[];
    allowedTraits?: Array<{ kind?: string; name: string }>;
    createdAt?: string;
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
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {
      workloadType: ct.workloadType || 'deployment',
      allowedWorkflows: ct.allowedWorkflows,
      allowedTraits: ct.allowedTraits,
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
      },
      labels: {
        [CHOREO_LABELS.MANAGED]: 'true',
      },
    },
    spec: {},
  };
}
