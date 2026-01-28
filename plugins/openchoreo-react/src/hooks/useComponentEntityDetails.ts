import { useCallback } from 'react';
import { Entity, parseEntityRef } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity, catalogApiRef } from '@backstage/plugin-catalog-react';

export interface ComponentEntityDetails {
  componentName: string;
  projectName: string;
  namespaceName: string;
}

/**
 * Custom hook to extract OpenChoreo component entity details (component, project, namespace)
 * from the current Backstage entity context by traversing entity relationships.
 *
 * This hook internally calls useEntity() to get the current entity and navigates
 * the Backstage catalog to find:
 * - Component name from the current entity
 * - Project name from entity.spec.system
 * - Namespace name from the project entity's spec.domain or annotations
 *
 * @returns An object with getEntityDetails callback function
 *
 * @example
 * ```tsx
 * const { getEntityDetails } = useComponentEntityDetails();
 *
 * useEffect(() => {
 *   const fetchData = async () => {
 *     try {
 *       const { componentName, projectName, namespaceName } = await getEntityDetails();
 *       // Use the details...
 *     } catch (error) {
 *       console.error('Failed to get entity details:', error);
 *     }
 *   };
 *   fetchData();
 * }, [getEntityDetails]);
 * ```
 */
export function useComponentEntityDetails() {
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);

  const getEntityDetails =
    useCallback(async (): Promise<ComponentEntityDetails> => {
      if (!entity.metadata.name) {
        throw new Error('Component name not found');
      }

      const componentName = entity.metadata.name;

      // Get project name from spec.system
      const systemValue = entity.spec?.system;
      if (!systemValue) {
        throw new Error('Project name not found in spec.system');
      }

      // Convert system value to string (it could be string or object)
      const projectName =
        typeof systemValue === 'string' ? systemValue : String(systemValue);

      // Fetch the project entity to get the namespace
      const entityNamespace = entity.metadata.namespace || 'default';
      const projectEntityRef = `system:${entityNamespace}/${projectName}`;
      const projectEntity = await catalogApi.getEntityByRef(projectEntityRef);

      if (!projectEntity) {
        throw new Error(`Project entity not found: ${projectEntityRef}`);
      }

      // Get namespace from the project entity's spec.domain or annotations.
      // spec.domain is a qualified ref (e.g. "default/team-alpha") — extract just the name.
      let namespaceName: string | undefined;
      if (projectEntity.spec?.domain) {
        const domainStr =
          typeof projectEntity.spec.domain === 'string'
            ? projectEntity.spec.domain
            : String(projectEntity.spec.domain);
        const domainRef = parseEntityRef(domainStr, {
          defaultKind: 'domain',
          defaultNamespace: 'default',
        });
        namespaceName = domainRef.name;
      }
      if (!namespaceName) {
        namespaceName =
          projectEntity.metadata.annotations?.['openchoreo.io/namespace'];
      }

      if (!namespaceName) {
        throw new Error(
          `Namespace name not found in project entity: ${projectEntityRef}`,
        );
      }

      return { componentName, projectName, namespaceName };
    }, [entity, catalogApi]);

  return { getEntityDetails };
}

/**
 * Standalone function to extract component entity details without hooks (for use outside React components)
 *
 * @param entity - The Backstage entity
 * @param catalogApi - The catalog API instance
 * @returns Promise resolving to ComponentEntityDetails
 */
export async function extractComponentEntityDetails(
  entity: Entity,
  catalogApi: { getEntityByRef: (ref: string) => Promise<Entity | undefined> },
): Promise<ComponentEntityDetails> {
  if (!entity.metadata.name) {
    throw new Error('Component name not found');
  }

  const componentName = entity.metadata.name;

  // Get project name from spec.system
  const systemValue = entity.spec?.system;
  if (!systemValue) {
    throw new Error('Project name not found in spec.system');
  }

  const projectName =
    typeof systemValue === 'string' ? systemValue : String(systemValue);

  // Fetch the project entity to get the namespace
  const entityNamespace = entity.metadata.namespace || 'default';
  const projectEntityRef = `system:${entityNamespace}/${projectName}`;
  const projectEntity = await catalogApi.getEntityByRef(projectEntityRef);

  if (!projectEntity) {
    throw new Error(`Project entity not found: ${projectEntityRef}`);
  }

  // Get namespace from the project entity's spec.domain or annotations.
  // spec.domain is a qualified ref (e.g. "default/team-alpha") — extract just the name.
  let namespaceName: string | undefined;
  if (projectEntity.spec?.domain) {
    const domainStr =
      typeof projectEntity.spec.domain === 'string'
        ? projectEntity.spec.domain
        : String(projectEntity.spec.domain);
    const domainRef = parseEntityRef(domainStr, {
      defaultKind: 'domain',
      defaultNamespace: 'default',
    });
    namespaceName = domainRef.name;
  }
  if (!namespaceName) {
    namespaceName =
      projectEntity.metadata.annotations?.['openchoreo.io/namespace'];
  }

  if (!namespaceName) {
    throw new Error(
      `Namespace name not found in project entity: ${projectEntityRef}`,
    );
  }

  return { componentName, projectName, namespaceName };
}
