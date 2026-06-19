import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ClusterProjectType kind Entity. Represents an OpenChoreo
 * cluster-scoped project type definition. Cluster-scoped sibling of
 * ProjectType — Projects in any namespace can reference it.
 *
 * @public
 */
export interface ClusterProjectTypeEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ClusterProjectType.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ClusterProjectType';
  /**
   * The specification of the ClusterProjectType Entity
   */
  spec: Record<string, never>;
}
