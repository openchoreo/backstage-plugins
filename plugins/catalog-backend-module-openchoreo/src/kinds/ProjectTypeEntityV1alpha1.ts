import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ProjectType kind Entity. Represents an OpenChoreo
 * namespaced project type definition — a platform-engineer template that
 * carries the parameter/environmentConfig schemas, validations, and
 * namespace-scoped resource templates applied to a project's cell namespace.
 *
 * @public
 */
export interface ProjectTypeEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ProjectType.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ProjectType';
  /**
   * The specification of the ProjectType Entity
   */
  spec: {
    /**
     * The domain this project type belongs to
     */
    domain?: string;
  };
}
