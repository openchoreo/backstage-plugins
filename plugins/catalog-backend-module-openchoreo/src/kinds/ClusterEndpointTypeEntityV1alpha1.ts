import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ClusterEndpointType kind Entity. Represents an OpenChoreo
 * cluster-scoped endpoint type: a routing template that Endpoints reference.
 *
 * @public
 */
export interface ClusterEndpointTypeEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ClusterEndpointType.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ClusterEndpointType';
  /**
   * The specification of the ClusterEndpointType Entity
   */
  spec: {
    /**
     * Ids of the resources the type renders per environment.
     */
    resources?: string[];
  };
}
