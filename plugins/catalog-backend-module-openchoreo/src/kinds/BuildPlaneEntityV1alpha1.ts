import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog BuildPlane kind Entity. Represents an OpenChoreo build plane.
 *
 * @public
 */
export interface BuildPlaneEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the BuildPlane.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'BuildPlane';
  /**
   * The specification of the BuildPlane Entity
   */
  spec: {
    /**
     * The domain this build plane belongs to
     */
    domain?: string;
    /**
     * Observability plane reference
     */
    observabilityPlaneRef?: string;
  };
}
