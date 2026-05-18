import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ClusterResourceType kind Entity. Represents an OpenChoreo cluster-scoped resource type definition.
 *
 * @public
 */
export interface ClusterResourceTypeEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ClusterResourceType.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ClusterResourceType';
  /**
   * The specification of the ClusterResourceType Entity
   */
  spec: {
    /**
     * Default retention for ResourceReleaseBindings of this type. Per-env override available on the binding.
     */
    retainPolicy?: 'Delete' | 'Retain';
  };
}
