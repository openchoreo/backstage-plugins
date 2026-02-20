import { Entity } from '@backstage/catalog-model';

/**
 * Backstage catalog TraitType kind Entity. Represents an OpenChoreo trait definition.
 *
 * @public
 */
export interface TraitTypeEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the TraitType.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'TraitType';
  /**
   * The specification of the TraitType Entity
   */
  spec: {
    /**
     * The domain this trait type belongs to
     */
    domain?: string;
  };
}
