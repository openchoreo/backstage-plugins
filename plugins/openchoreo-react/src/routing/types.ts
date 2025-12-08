/**
 * Environment pending action types for deploy/promote operations
 */

export interface PendingDeployAction {
  type: 'deploy';
  releaseName: string;
  targetEnvironment: string;
}

export interface PendingPromoteAction {
  type: 'promote';
  releaseName: string;
  sourceEnvironment: string;
  targetEnvironment: string;
}

export type PendingAction = PendingDeployAction | PendingPromoteAction;

/**
 * Environment view types
 */
export type EnvironmentView =
  | 'list'
  | 'workload-config'
  | 'overrides'
  | 'release-details';

/**
 * Workflow view types
 */
export type WorkflowView = 'list' | 'config' | 'run-details';
export type WorkflowTab = 'runs' | 'configurations';
export type RunDetailsTab = 'logs' | 'details';
