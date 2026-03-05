import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog ClusterTraitType kind Entity. Represents an OpenChoreo cluster-scoped trait definition.
 *
 * @public
 */
export interface ClusterTraitTypeEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the ClusterTraitType.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'ClusterTraitType';
  /**
   * The specification of the ClusterTraitType Entity
   */
  spec: Record<string, never>;
}
