import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog WorkflowRun kind Entity.
 * Represents an OpenChoreo workflow run (execution instance of a Workflow).
 *
 * @public
 */
export interface WorkflowRunEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the WorkflowRun.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'WorkflowRun';
  /**
   * The specification of the WorkflowRun Entity
   */
  spec: {
    /**
     * The type of entity (always 'workflow-run')
     */
    type: string;
    /**
     * The domain this workflow run belongs to
     */
    domain?: string;
    /**
     * The name of the referenced Workflow
     */
    workflowName?: string;
    /**
     * The current status of the workflow run
     */
    status?: string;
  };
}
