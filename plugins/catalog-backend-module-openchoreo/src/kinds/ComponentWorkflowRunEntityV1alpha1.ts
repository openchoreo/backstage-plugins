import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ComponentWorkflowRun kind Entity.
 * Represents an OpenChoreo component workflow run (build execution instance).
 *
 * @public
 */
export interface ComponentWorkflowRunEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ComponentWorkflowRun.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ComponentWorkflowRun';
  /**
   * The specification of the ComponentWorkflowRun Entity
   */
  spec: {
    /**
     * The type of entity (always 'component-workflow-run')
     */
    type: string;
    /**
     * The domain this workflow run belongs to
     */
    domain?: string;
    /**
     * The name of the owning component
     */
    componentName: string;
    /**
     * The name of the owning project
     */
    projectName: string;
    /**
     * The name of the referenced ComponentWorkflow
     */
    workflowName?: string;
    /**
     * The git commit SHA for this run
     */
    commit?: string;
    /**
     * The current status of the workflow run
     */
    status?: string;
    /**
     * The built container image
     */
    image?: string;
  };
}
