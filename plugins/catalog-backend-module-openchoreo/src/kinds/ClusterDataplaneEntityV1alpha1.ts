import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ClusterDataplane kind Entity. Represents an OpenChoreo cluster-scoped data plane.
 *
 * @public
 */
export interface ClusterDataplaneEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ClusterDataplane.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ClusterDataplane';
  /**
   * The specification of the ClusterDataplane Entity
   */
  spec: {
    /**
     * Gateway configuration for this dataplane
     */
    gateway?: {
      ingress?: {
        external?: {
          http?: { host?: string; port?: number };
          https?: { port?: number };
        };
        internal?: {
          http?: { host?: string; port?: number };
          https?: { port?: number };
        };
      };
    };
    /**
     * Observability plane reference
     */
    observabilityPlaneRef?: string;
  };
}
