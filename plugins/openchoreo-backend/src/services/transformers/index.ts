/**
 * Transformers for mapping K8s-style OpenChoreo resources to legacy flat response shapes.
 *
 * These pure functions are used by BFF services when `openchoreo.useNewApi` is enabled,
 * ensuring the frontend receives the same response shape regardless of which API version
 * the backend communicates with.
 *
 * @packageDocumentation
 */

export { transformProject } from './project';
export { transformComponent } from './component';
export { transformEnvironment } from './environment';
export { transformDataPlane } from './dataplane';
export { transformBuildPlane } from './buildplane';
export { transformObservabilityPlane } from './observabilityplane';
export { transformComponentWorkflowRun } from './workflow-run';
export { transformDeploymentPipeline } from './deployment-pipeline';
export { transformSecretReference } from './secret-reference';
