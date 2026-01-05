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
} as const;

export const CHOREO_LABELS = {
  MANAGED: 'openchoreo.io/managed',
} as const;
