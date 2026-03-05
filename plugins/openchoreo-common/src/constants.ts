export const CHOREO_ANNOTATIONS = {
  PROJECT: 'openchoreo.io/project',
  DEPLOYMENT: 'openchoreo.io/deployment',
  ENDPOINT: 'openchoreo.io/endpoint',
  ENVIRONMENT: 'openchoreo.io/environment',
  ENVIRONMENT_UID: 'openchoreo.io/environment-uid',
  COMPONENT: 'openchoreo.io/component',
  COMPONENT_UID: 'openchoreo.io/component-uid',
  BRANCH: 'openchoreo.io/branch',
  WORKLOAD: 'openchoreo.io/workload',
  WORKLOAD_TYPE: 'openchoreo.io/workload-type',
  NAMESPACE: 'openchoreo.io/namespace',
  CREATED_AT: 'openchoreo.io/created-at',
  STATUS: 'openchoreo.io/status',
  PROJECT_ID: 'openchoreo.io/project-id',
  PROJECT_UID: 'openchoreo.io/project-uid',
  COMPONENT_TYPE: 'openchoreo.io/component-type',
  COMPONENT_TYPE_KIND: 'openchoreo.io/component-type-kind',
  ENDPOINT_NAME: 'openchoreo.io/endpoint-name',
  ENDPOINT_TYPE: 'openchoreo.io/endpoint-type',
  ENDPOINT_PORT: 'openchoreo.io/endpoint-port',
  ENDPOINT_VISIBILITY: 'openchoreo.io/endpoint-visibility',
  // Component Type Definition (CTD) annotations
  CTD_NAME: 'openchoreo.io/ctd-name',
  CTD_DISPLAY_NAME: 'openchoreo.io/ctd-display-name',
  CTD_GENERATED: 'openchoreo.io/ctd-generated',
  CTD_KIND: 'openchoreo.io/ctd-kind',
  // Deletion tracking
  DELETION_TIMESTAMP: 'openchoreo.io/deletion-timestamp',
  // Agent connection status
  AGENT_CONNECTED: 'openchoreo.io/agent-connected',
  AGENT_CONNECTED_COUNT: 'openchoreo.io/agent-connected-count',
  AGENT_LAST_HEARTBEAT: 'openchoreo.io/agent-last-heartbeat',
  AGENT_LAST_CONNECTED: 'openchoreo.io/agent-last-connected',
  AGENT_LAST_DISCONNECTED: 'openchoreo.io/agent-last-disconnected',
  AGENT_MESSAGE: 'openchoreo.io/agent-message',
  // Observability
  OBSERVABILITY_PLANE_REF: 'openchoreo.io/observability-plane-ref',
  OBSERVER_URL: 'openchoreo.io/observer-url',
  // Data plane reference kind (DataPlane vs ClusterDataPlane)
  DATA_PLANE_REF_KIND: 'openchoreo.io/data-plane-ref-kind',
  // Build plane reference
  BUILD_PLANE_REF: 'openchoreo.io/build-plane-ref',
  BUILD_PLANE_REF_KIND: 'openchoreo.io/build-plane-ref-kind',
  // Workflow parameters schema
  WORKFLOW_PARAMETERS: 'openchoreo.dev/component-workflow-parameters',
} as const;

export const CHOREO_LABELS = {
  MANAGED: 'openchoreo.io/managed',
  WORKFLOW_PROJECT: 'openchoreo.dev/project',
  WORKFLOW_COMPONENT: 'openchoreo.dev/component',
} as const;

/**
 * Custom relation types for OpenChoreo entities.
 * These extend the standard Backstage relations.
 */

/**
 * A relation indicating that a DeploymentPipeline promotes deployments to an Environment.
 * The source is the pipeline, the target is the environment.
 */
export const RELATION_PROMOTES_TO = 'promotesTo';

/**
 * A relation indicating that an Environment receives promotions from a DeploymentPipeline.
 * This is the inverse of RELATION_PROMOTES_TO.
 */
export const RELATION_PROMOTED_BY = 'promotedBy';

/**
 * A relation indicating that a System (Project) uses a DeploymentPipeline.
 * The source is the project, the target is the pipeline.
 */
export const RELATION_USES_PIPELINE = 'usesPipeline';

/**
 * A relation indicating that a DeploymentPipeline is used by a System (Project).
 * This is the inverse of RELATION_USES_PIPELINE.
 */
export const RELATION_PIPELINE_USED_BY = 'pipelineUsedBy';

/**
 * A relation indicating that an Environment is hosted on a DataPlane.
 * The source is the environment, the target is the dataplane.
 */
export const RELATION_HOSTED_ON = 'hostedOn';

/**
 * A relation indicating that a DataPlane hosts Environments.
 * This is the inverse of RELATION_HOSTED_ON.
 */
export const RELATION_HOSTS = 'hosts';

/**
 * A relation indicating that a DataPlane/BuildPlane is observed by an ObservabilityPlane.
 * The source is the DataPlane/BuildPlane, the target is the ObservabilityPlane.
 */
export const RELATION_OBSERVED_BY = 'observedBy';

/**
 * A relation indicating that an ObservabilityPlane observes DataPlanes/BuildPlanes.
 * This is the inverse of RELATION_OBSERVED_BY.
 */
export const RELATION_OBSERVES = 'observes';

/**
 * A relation indicating that a System (Project) builds on a BuildPlane or ClusterBuildPlane.
 * The source is the project, the target is the build plane.
 */
export const RELATION_BUILDS_ON = 'buildsOn';

/**
 * A relation indicating that a BuildPlane or ClusterBuildPlane builds for a System (Project).
 * This is the inverse of RELATION_BUILDS_ON.
 */
export const RELATION_BUILDS = 'builds';

/**
 * A relation indicating that a Component is an instance of a ComponentType.
 * The source is the Component, the target is the ComponentType.
 */
export const RELATION_INSTANCE_OF = 'instanceOf';

/**
 * A relation indicating that a ComponentType has a Component instance.
 * This is the inverse of RELATION_INSTANCE_OF.
 */
export const RELATION_HAS_INSTANCE = 'hasInstance';

/**
 * A relation indicating that a ComponentType uses a ComponentWorkflow (via allowedWorkflows).
 * The source is the ComponentType, the target is the ComponentWorkflow.
 */
export const RELATION_USES_WORKFLOW = 'usesWorkflow';

/**
 * A relation indicating that a ComponentWorkflow is used by a ComponentType.
 * This is the inverse of RELATION_USES_WORKFLOW.
 */
export const RELATION_WORKFLOW_USED_BY = 'workflowUsedBy';
