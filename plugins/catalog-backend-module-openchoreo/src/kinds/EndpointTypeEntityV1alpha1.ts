import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog EndpointType kind Entity. Represents an OpenChoreo
 * namespaced endpoint type: a routing template that Endpoints reference.
 *
 * @public
 */
export interface EndpointTypeEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the EndpointType.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'EndpointType';
  /**
   * The specification of the EndpointType Entity
   */
  spec: {
    /**
     * The domain this endpoint type belongs to
     */
    domain?: string;
    /**
     * Ids of the resources the type renders per environment.
     */
    resources?: string[];
  };
}
