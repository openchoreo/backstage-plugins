import {
  CatalogProcessorEmit,
  processingResult,
} from '@backstage/plugin-catalog-node';
import {
  RELATION_USES_WORKFLOW,
  RELATION_WORKFLOW_USED_BY,
} from '@openchoreo/backstage-plugin-common';

export const CLUSTER_ENTITY_NAMESPACE = 'openchoreo-cluster';

/**
 * Emits usesWorkflow / workflowUsedBy between a hook entity and the Workflow or
 * ClusterWorkflow it runs, so the hook page can link to the workflow and the
 * workflow page can list the hooks built on it.
 */
export function emitHookWorkflowRelation(
  sourceRef: { kind: string; namespace: string; name: string },
  workflowRef: { kind?: string; name?: string } | undefined,
  emit: CatalogProcessorEmit,
): void {
  if (!workflowRef?.name) {
    return;
  }
  const isCluster = workflowRef.kind === 'ClusterWorkflow';
  const target = {
    kind: isCluster ? 'clusterworkflow' : 'workflow',
    namespace: isCluster ? CLUSTER_ENTITY_NAMESPACE : sourceRef.namespace,
    name: workflowRef.name,
  };
  emit(
    processingResult.relation({
      source: sourceRef,
      target,
      type: RELATION_USES_WORKFLOW,
    }),
  );
  emit(
    processingResult.relation({
      source: target,
      target: sourceRef,
      type: RELATION_WORKFLOW_USED_BY,
    }),
  );
}
