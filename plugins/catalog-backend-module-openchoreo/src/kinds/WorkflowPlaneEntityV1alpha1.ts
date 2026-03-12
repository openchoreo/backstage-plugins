import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog WorkflowPlane kind Entity. Represents an OpenChoreo workflow plane.
 *
 * @public
 */
export interface WorkflowPlaneEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the WorkflowPlane.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'WorkflowPlane';
  /**
   * The specification of the WorkflowPlane Entity
   */
  spec: {
    /**
     * The domain this workflow plane belongs to
     */
    domain?: string;
    /**
     * Observability plane reference
     */
    observabilityPlaneRef?: string;
  };
}
