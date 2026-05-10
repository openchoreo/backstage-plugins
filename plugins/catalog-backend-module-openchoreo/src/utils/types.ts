import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';

type NewComponent = OpenChoreoComponents['schemas']['Component'];

/**
 * A workload endpoint as it appears under workload.spec.endpoints. Defined
 * locally because the generated Workload schema uses additionalProperties.
 */
export interface WorkloadEndpoint {
  type: string;
  port: number;
  visibility?: string[];
  schema?: {
    type?: string;
    content?: string;
  };
}

/**
 * A dependency connection declared on a Workload's
 * spec.dependencies.endpoints[]. Identifies a target endpoint on another
 * component (optionally in a different project).
 */
export interface WorkloadDependency {
  project?: string;
  component: string;
  name: string;
  visibility: string;
}

/**
 * Per-component data collected during the periodic full sync's first pass
 * and reused in the second pass to build Component / API entities. Not
 * used by the per-event delta path, which fetches resources on demand.
 */
export interface ComponentWorkloadData {
  component: NewComponent;
  projectName: string;
  /** Endpoints with schemas — used for API entities and providesApis */
  schemaEndpoints: Record<string, WorkloadEndpoint>;
  /** All endpoints — used for consumed API resolution */
  allEndpoints: Record<string, WorkloadEndpoint>;
  /** Dependency connections from workload spec */
  dependencies: WorkloadDependency[];
  /**
   * Owning Workload's `metadata.name` if a Workload was paired with
   * this Component during the first sync pass. Threaded through to the
   * Component / API entity translators so they can stamp the
   * `openchoreo.io/workload` annotation on emitted entities — the
   * workload-deletion event handler relies on that annotation to find
   * derived API entities by catalog query.
   */
  workloadName?: string;
}
