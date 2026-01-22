export const CHOREO_ANNOTATIONS = {
  PROJECT: 'openchoreo.io/project',
  ORGANIZATION: 'openchoreo.io/organization',
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
  ENDPOINT_NAME: 'openchoreo.io/endpoint-name',
  ENDPOINT_TYPE: 'openchoreo.io/endpoint-type',
  ENDPOINT_PORT: 'openchoreo.io/endpoint-port',
  // Component Type Definition (CTD) annotations
  CTD_NAME: 'openchoreo.io/ctd-name',
  CTD_DISPLAY_NAME: 'openchoreo.io/ctd-display-name',
  CTD_GENERATED: 'openchoreo.io/ctd-generated',
  // Deletion tracking
  DELETION_TIMESTAMP: 'openchoreo.io/deletion-timestamp',
} as const;

export const CHOREO_LABELS = {
  MANAGED: 'openchoreo.io/managed',
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
