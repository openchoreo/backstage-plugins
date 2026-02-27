import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ClusterBuildPlane kind Entity. Represents an OpenChoreo cluster-scoped build plane.
 *
 * @public
 */
export interface ClusterBuildPlaneEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ClusterBuildPlane.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ClusterBuildPlane';
  /**
   * The specification of the ClusterBuildPlane Entity
   */
  spec: {
    /**
     * Observability plane reference
     */
    observabilityPlaneRef?: string;
  };
}
