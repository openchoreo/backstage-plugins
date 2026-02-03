import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ComponentWorkflow kind Entity. Represents an OpenChoreo component workflow (build workflow).
 *
 * @public
 */
export interface ComponentWorkflowEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ComponentWorkflow.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ComponentWorkflow';
  /**
   * The specification of the ComponentWorkflow Entity
   */
  spec: {
    /**
     * The type of entity (always 'component-workflow')
     */
    type: string;
    /**
     * The domain this component workflow belongs to
     */
    domain?: string;
  };
}
