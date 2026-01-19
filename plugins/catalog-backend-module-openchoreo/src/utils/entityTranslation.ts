import { Entity } from '@backstage/catalog-model';
import { type OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import {
  CHOREO_ANNOTATIONS,
  CHOREO_LABELS,
  getRepositoryInfo,
  ComponentTypeUtils,
} from '@openchoreo/backstage-plugin-common';

type ModelsComponent = OpenChoreoComponents['schemas']['ComponentResponse'];

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
