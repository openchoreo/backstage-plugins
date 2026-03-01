import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog Workflow kind Entity. Represents an OpenChoreo generic workflow.
 *
 * @public
 */
export interface WorkflowEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the Workflow.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'Workflow';
  /**
   * The specification of the Workflow Entity
   */
  spec: {
    /**
     * The domain this workflow belongs to
     */
    domain?: string;
    /**
     * The type of workflow (e.g. 'CI' or 'Generic')
     */
    type?: string;
  };
}
