import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ObservabilityPlane kind Entity. Represents an OpenChoreo observability plane.
 *
 * @public
 */
export interface ObservabilityPlaneEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ObservabilityPlane.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ObservabilityPlane';
  /**
   * The specification of the ObservabilityPlane Entity
   */
  spec: {
    /**
     * The domain this observability plane belongs to
     */
    domain?: string;
    /**
     * The observer URL for this observability plane
     */
    observerURL?: string;
  };
}
