import { Entity } from '@backstage/catalog-model';
import { JsonObject } from '@backstage/types';

/**
 * Backstage catalog ReleaseLine kind Entity. Represents an OpenChoreo release
 * line: a named series of releases of one component, built and deployed
 * independently of the component's other lines.
 *
 * @public
 */
export interface ReleaseLineEntityV1alpha1 extends Entity {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'ReleaseLine';
  spec: {
    /** Entity ref of the component the line belongs to, e.g. `component:default/hello` */
    component: string;
    /** Project (System) of the component */
    system: string;
    owner: string;
    /** Overrides the component's autoDeploy for this line */
    autoDeploy?: boolean;
    /** Deep-merged onto the component's parameters for this line */
    parameters?: JsonObject;
    /** Merged onto the component's traits for this line */
    traits?: JsonObject[];
    /** Build overrides for this line */
    workflow?: { parameters?: JsonObject };
  };
}
