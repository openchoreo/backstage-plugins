import { Entity } from '@backstage/catalog-model';
import { JsonValue } from '@backstage/types';
import type {
  HookEntityParameter,
  HookEntitySubjectRef,
  HookEntityWorkflowRef,
} from './HookEntityV1alpha1';

/**
 * Backstage entity for a cluster-scoped OpenChoreo `ClusterHook` (deployment
 * hooks, alpha). Cluster-scoped: no domain relation; may only reference a
 * ClusterWorkflow.
 */
export interface ClusterHookEntityV1alpha1 extends Entity {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'ClusterHook';
  spec: {
    type?: string;
    workflowRef: HookEntityWorkflowRef;
    enabledTo?: HookEntitySubjectRef[];
    parameters?: HookEntityParameter[];
    [key: string]: JsonValue | undefined;
  };
}
