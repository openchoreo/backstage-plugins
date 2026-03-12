import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ClusterWorkflow kind Entity. Represents an OpenChoreo cluster-scoped workflow.
 *
 * @public
 */
export interface ClusterWorkflowEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ClusterWorkflow.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ClusterWorkflow';
  /**
   * The specification of the ClusterWorkflow Entity
   */
  spec: {
    /**
     * The type of workflow (e.g. 'CI' or 'Generic')
     */
    type?: string;
    /**
     * Reference to the ClusterWorkflowPlane this workflow builds on.
     */
    workflowPlaneRef?: string;
    /**
     * Kind of the workflow plane reference (always ClusterWorkflowPlane for cluster workflows)
     */
    workflowPlaneRefKind?: string;
  };
}
