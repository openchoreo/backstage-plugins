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
