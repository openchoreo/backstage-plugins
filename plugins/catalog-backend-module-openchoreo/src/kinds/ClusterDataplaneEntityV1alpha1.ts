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
     * Public virtual host for this dataplane
     */
    publicVirtualHost?: string;
    /**
     * Namespace virtual host for this dataplane
     */
    namespaceVirtualHost?: string;
    /**
     * Public HTTP port
     */
    publicHTTPPort?: number;
    /**
     * Public HTTPS port
     */
    publicHTTPSPort?: number;
    /**
     * Namespace HTTP port
     */
    namespaceHTTPPort?: number;
    /**
     * Namespace HTTPS port
     */
    namespaceHTTPSPort?: number;
    /**
     * Observability plane reference
     */
    observabilityPlaneRef?: string;
  };
}
