/**
 * Shared types for scaffolder workflow field extensions.
 */

export type WorkflowKind = 'Workflow' | 'ClusterWorkflow' | 'ComponentWorkflow';

export interface WorkflowSelection {
  kind: WorkflowKind;
  name: string;
}

/**
 * Namespace used for cluster-scoped resources such as ClusterWorkflows
 * and ClusterComponentType templates.
 */
export const CLUSTER_WORKFLOW_NAMESPACE = 'openchoreo-cluster';
