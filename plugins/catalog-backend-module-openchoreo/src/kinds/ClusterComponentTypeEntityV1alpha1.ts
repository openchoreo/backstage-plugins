import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ClusterComponentType kind Entity. Represents an OpenChoreo cluster-scoped component type definition.
 *
 * @public
 */
export interface ClusterComponentTypeEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ClusterComponentType.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ClusterComponentType';
  /**
   * The specification of the ClusterComponentType Entity
   */
  spec: {
    /**
     * Workload type: deployment, statefulset, cronjob, job, proxy
     */
    workloadType: string;
    /**
     * List of allowed component workflow names
     */
    allowedWorkflows?: string[];
    /**
     * List of allowed trait names for this cluster component type (always ClusterTrait kind)
     */
    allowedTraits?: Array<{ kind?: string; name: string }>;
  };
}
