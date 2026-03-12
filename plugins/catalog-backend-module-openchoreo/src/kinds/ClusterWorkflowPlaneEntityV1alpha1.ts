import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ClusterWorkflowPlane kind Entity. Represents an OpenChoreo cluster-scoped workflow plane.
 *
 * @public
 */
export interface ClusterWorkflowPlaneEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ClusterWorkflowPlane.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ClusterWorkflowPlane';
  /**
   * The specification of the ClusterWorkflowPlane Entity
   */
  spec: {
    /**
     * Observability plane reference
     */
    observabilityPlaneRef?: string;
  };
}
