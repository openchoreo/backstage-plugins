import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ClusterObservabilityPlane kind Entity. Represents an OpenChoreo cluster-scoped observability plane.
 *
 * @public
 */
export interface ClusterObservabilityPlaneEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ClusterObservabilityPlane.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ClusterObservabilityPlane';
  /**
   * The specification of the ClusterObservabilityPlane Entity
   */
  spec: {
    /**
     * The observer URL for this cluster observability plane
     */
    observerURL?: string;
  };
}
