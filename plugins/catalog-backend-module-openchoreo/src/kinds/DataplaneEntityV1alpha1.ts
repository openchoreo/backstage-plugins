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
     * The type of dataplane (e.g., 'kubernetes', 'cloud')
     */
    type: string;
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
     * Organization virtual host for this dataplane
     */
    organizationVirtualHost?: string;
    /**
     * Public HTTP port
     */
    publicHTTPPort?: number;
    /**
     * Public HTTPS port
     */
    publicHTTPSPort?: number;
    /**
     * Organization HTTP port
     */
    organizationHTTPPort?: number;
    /**
     * Organization HTTPS port
     */
    organizationHTTPSPort?: number;
    /**
     * Observability plane reference
     */
    observabilityPlaneRef?: string;
  };
}
