import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ResourceType kind Entity. Represents an OpenChoreo
 * namespaced resource type definition.
 *
 * @public
 */
export interface ResourceTypeEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ResourceType.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ResourceType';
  /**
   * The specification of the ResourceType Entity
   */
  spec: {
    /**
     * The domain this resource type belongs to
     */
    domain?: string;
    /**
     * Default retention for ResourceReleaseBindings of this type.
     * Per-env override available on the binding.
     */
    retainPolicy?: 'Delete' | 'Retain';
  };
}
