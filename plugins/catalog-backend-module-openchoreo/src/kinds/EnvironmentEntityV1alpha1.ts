import { Entity } from '@backstage/catalog-model';
import { JsonValue } from '@backstage/types';

/**
 * A hook bound on an environment (deployment hooks, alpha). Mirrors the
 * CRD `HookBinding`; kept JSON-shaped so it can live inside entity spec.
 *
 * @public
 */
export interface EnvironmentHookBinding {
  name: string;
  hookRef: {
    kind?: string;
    name: string;
    [key: string]: JsonValue | undefined;
  };
  mode?: string;
  parameters?: { [key: string]: JsonValue | undefined };
  appliesTo?: Array<{
    kind: string;
    name: string;
    [key: string]: JsonValue | undefined;
  }>;
  onFailure?: string;
  timeout?: string;
  retries?: number;
  [key: string]: JsonValue | undefined;
}

/**
 * Pre-deploy and post-deploy bindings of an environment.
 *
 * @public
 */
export interface EnvironmentHookSet {
  preDeploy?: EnvironmentHookBinding[];
  postDeploy?: EnvironmentHookBinding[];
  [key: string]: JsonValue | undefined;
}

/**
 * Backstage catalog Environment kind Entity. Represents an OpenChoreo environment.
 *
 * @public
 */
export interface EnvironmentEntityV1alpha1 extends Entity {
  /**
   * The apiVersion string of the Environment.
   */
  apiVersion: 'backstage.io/v1alpha1';
  /**
   * The kind of the entity
   */
  kind: 'Environment';
  /**
   * The specification of the Environment Entity
   */
  spec: {
    /**
     * The type of environment (e.g., 'development', 'staging', 'production')
     */
    type: string;
    /**
     * The domain this environment belongs to
     */
    domain?: string;
    /**
     * Whether this is a production environment
     */
    isProduction?: boolean;
    /**
     * The data plane reference for this environment
     */
    dataPlaneRef?: string;
    /**
     * DNS prefix for this environment
     */
    dnsPrefix?: string;
    /**
     * Gateway configuration for this environment
     */
    gateway?: {
      ingress?: {
        external?: {
          name?: string;
          namespace?: string;
          http?: { host?: string; port?: number };
          https?: { host?: string; port?: number };
        };
        internal?: {
          name?: string;
          namespace?: string;
          http?: { host?: string; port?: number };
          https?: { host?: string; port?: number };
        };
      };
    };
    /**
     * Deployment hooks (alpha) run for every component deployment into this environment
     */
    hooks?: EnvironmentHookSet;
  };
}
