import { Entity } from '@backstage/catalog-model';
import { JsonValue } from '@backstage/types';

/**
 * One workflow input and its value source, as declared on the Hook CR.
 * Exactly one of value / from / default / required is set.
 */
export interface HookEntityParameter {
  name: string;
  value?: string;
  from?: string;
  default?: string;
  overridable?: boolean;
  required?: boolean;
  [key: string]: JsonValue | undefined;
}

export interface HookEntityWorkflowRef {
  kind: string;
  name: string;
  [key: string]: JsonValue | undefined;
}

export interface HookEntitySubjectRef {
  kind: string;
  name: string;
  [key: string]: JsonValue | undefined;
}

/**
 * Backstage entity for a namespaced OpenChoreo `Hook` (deployment hooks, alpha).
 * The spec is the CRD spec carried through verbatim plus the domain link.
 */
export interface HookEntityV1alpha1 extends Entity {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'Hook';
  spec: {
    domain?: string;
    type?: string;
    workflowRef: HookEntityWorkflowRef;
    enabledTo?: HookEntitySubjectRef[];
    parameters?: HookEntityParameter[];
    [key: string]: JsonValue | undefined;
  };
}
