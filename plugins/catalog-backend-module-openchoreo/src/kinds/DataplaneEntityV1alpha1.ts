import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog Dataplane kind Entity. Represents an OpenChoreo data plane.
 *
 * @public
 */
export interface DataplaneEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the Dataplane.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'Dataplane';
  /**
   * The specification of the Dataplane Entity
   */
  spec: {
    /**
     * The domain this dataplane belongs to
     */
    domain?: string;
    /**
     * Registry prefix for this dataplane
     */
    registryPrefix?: string;
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
