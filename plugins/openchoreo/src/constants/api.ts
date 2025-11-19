export const API_ENDPOINTS = {
  ENVIRONMENT_INFO: '/deploy',
  PROMOTE_DEPLOYMENT: '/promote-deployment',
  DELETE_RELEASE_BINDING: '/delete-release-binding',
  CELL_DIAGRAM: '/cell-diagram',
  RUNTIME_LOGS: '/logs/component',
  DEPLOYEMNT_WORKLOAD: '/workload',
  UPDATE_BINDING: '/update-binding',
  DASHBOARD_BINDINGS_COUNT: '/dashboard/bindings-count',
  CREATE_RELEASE: '/create-release',
  DEPLOY_RELEASE: '/deploy-release',
} as const;
