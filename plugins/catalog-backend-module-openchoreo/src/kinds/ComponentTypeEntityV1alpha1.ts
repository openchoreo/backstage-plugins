import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ComponentType kind Entity. Represents an OpenChoreo component type definition.
 *
 * @public
 */
export interface ComponentTypeEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ComponentType.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ComponentType';
  /**
   * The specification of the ComponentType Entity
   */
  spec: {
    /**
     * The type of entity (always 'component-type')
     */
    type: string;
    /**
     * The domain this component type belongs to
     */
    domain?: string;
    /**
     * Workload type: deployment, statefulset, cronjob, job, proxy
     */
    workloadType: string;
    /**
     * List of allowed component workflow names
     */
    allowedWorkflows?: string[];
    /**
     * List of allowed trait names for this component type
     */
    allowedTraits?: string[];
  };
}
