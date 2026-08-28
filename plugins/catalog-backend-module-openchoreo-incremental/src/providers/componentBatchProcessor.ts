// Batch translation of OpenChoreo components into Backstage entities.
//
// Components arrive FLAT per namespace (the new API lists components at
// /api/v1/namespaces/{namespaceName}/components with no project nesting);
// the owning project is read from each component's spec
// (`spec.owner.projectName`).
//
// NOTE: The original implementation enriched "Service" components via
// detail fetches to derive API entities (providesApis/consumesApis).
// Deriving API entities requires helpers (e.g.
// createApiEntitiesFromNewWorkload) that are still internal to the
// non-incremental sibling module, so API-entity derivation is deferred
// until the sibling exports them. This processor does a plain per-item
// translation with no additional API calls.

import type { Entity } from '@backstage/catalog-model';
import type { Config } from '@backstage/config';
import type { LoggerService } from '@backstage/backend-plugin-api';
import {
  createOpenChoreoApiClient,
  getCreatedAt,
  getDeletionTimestamp,
  getDescription,
  getDisplayName,
  getName,
  getUid,
  isReady,
  type OpenChoreoComponents,
} from '@openchoreo/openchoreo-client-node';
import {
  ComponentTypeUtils,
  type ComponentResponse,
} from '@openchoreo/backstage-plugin-common';
import { translateComponentToEntity } from '@openchoreo/backstage-plugin-catalog-backend-module';

type NewComponent = OpenChoreoComponents['schemas']['Component'];

/** The typed OpenChoreo API client returned by createOpenChoreoApiClient. */
type OpenChoreoApiClient = ReturnType<typeof createOpenChoreoApiClient>;

/** Shared translation configuration supplied by the provider. */
export interface ComponentBatchProcessorOptions {
  /** Location key (already `provider:`-prefixed) stamped on entities. */
  locationKey: string;
  /** Default owner ref used as `spec.owner`. */
  defaultOwner: string;
  /** Runtime component-type utilities built from config. */
  componentTypeUtils: ComponentTypeUtils;
}

/**
 * Processes a batch of components from a single API page and translates
 * them into Backstage Component entities.
 */
export class ComponentBatchProcessor {
  constructor(private readonly options: ComponentBatchProcessorOptions) {}

  /**
   * Translates a page of components into Component entities.
   *
   * @param _client - API client (currently unused; detail fetches are
   *   deferred — see the file-level note)
   * @param components - Components from one list page
   * @param namespaceName - Namespace the components belong to
   * @param context - Provider context for logging
   * @returns Array of translated entities
   */
  async translateComponentsWithApisBatch(
    _client: OpenChoreoApiClient,
    components: NewComponent[],
    namespaceName: string,
    context: { logger: LoggerService; config: Config },
  ): Promise<Entity[]> {
    const entities: Entity[] = [];

    for (const component of components) {
      const componentName = getName(component);
      if (!componentName) {
        context.logger.debug(
          `Skipping component without a name in namespace ${namespaceName}`,
        );
        continue;
      }

      // The owning project lives on the component spec
      // (ComponentSpec.owner.projectName). Fall back to the namespace name
      // so the entity still gets a valid spec.system value.
      const projectName = component.spec?.owner?.projectName;
      if (!projectName) {
        context.logger.debug(
          `Component ${componentName} in namespace ${namespaceName} has no project reference; attributing to the namespace`,
        );
      }
      const effectiveProjectName = projectName ?? namespaceName;

      const componentTypeRef = component.spec?.componentType;
      const componentType =
        typeof componentTypeRef === 'string'
          ? componentTypeRef
          : componentTypeRef?.name ?? '';

      entities.push(
        translateComponentToEntity(
          {
            name: componentName,
            displayName: getDisplayName(component),
            uid: getUid(component),
            type: componentType,
            componentType:
              typeof componentTypeRef === 'object' && componentTypeRef
                ? {
                    kind: componentTypeRef.kind,
                    name: componentTypeRef.name,
                  }
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
          } as ComponentResponse,
          namespaceName,
          effectiveProjectName,
          {
            defaultOwner: this.options.defaultOwner,
            componentTypeUtils: this.options.componentTypeUtils,
            locationKey: this.options.locationKey,
          },
        ),
      );
    }

    return entities;
  }
}
