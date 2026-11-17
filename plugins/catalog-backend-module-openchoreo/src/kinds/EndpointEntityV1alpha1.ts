import { Entity } from '@backstage/catalog-model';

/**
 * One traffic backend of an Endpoint. A type alias rather than an interface
 * so it stays assignable to the catalog model's JsonObject.
 *
 * @public
 */
export type EndpointBackendV1alpha1 = {
  /** Identifies this backend within the Endpoint. */
  name: string;
  /** Kind of backend. Only `Component` exists today. */
  kind: string;
  /** Backend component name, for `Component` backends. */
  component?: string;
  /** Workload endpoint name on the backend component. */
  endpoint?: string;
  /** Relative share of traffic. */
  weight?: number;
};

/**
 * Backstage catalog Endpoint kind Entity. Represents an OpenChoreo Endpoint:
 * a project-scoped route to one or more component workload endpoints,
 * rendered through an (Cluster)EndpointType template.
 *
 * @public
 */
export interface EndpointEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the Endpoint.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'Endpoint';
  /**
   * The specification of the Endpoint Entity
   */
  spec: {
    /** Name of the referenced (Cluster)EndpointType. */
    type: string;
    /** Owner entity ref. */
    owner: string;
    /** The owning project, as a System entity ref. */
    system: string;
    /** Scopes the Endpoint exposes its backends to. */
    visibility: string[];
    /** Backends the Endpoint routes traffic to. */
    backends: EndpointBackendV1alpha1[];
    /** Entity ref of the API entity describing this Endpoint's schema, if any. */
    providesApi?: string;
  };
}
