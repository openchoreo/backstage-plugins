/**
 * Builds a K8s-style object metadata structure with sensible defaults.
 * Override any field via the `overrides` parameter.
 */
export function buildK8sObjectMeta(
  overrides: Partial<{
    name: string;
    namespace: string;
    uid: string;
    creationTimestamp: string;
    labels: Record<string, string>;
    annotations: Record<string, string>;
  }> = {},
) {
  const name = overrides.name ?? 'test-resource';
  return {
    name,
    namespace: overrides.namespace ?? 'test-ns',
    uid: overrides.uid ?? `uid-${name}`,
    creationTimestamp: overrides.creationTimestamp ?? '2025-01-06T10:00:00Z',
    labels: overrides.labels ?? {},
    annotations: overrides.annotations ?? {
      'openchoreo.dev/display-name': name,
      'openchoreo.dev/description': `Test ${name}`,
    },
  };
}

/**
 * Builds a K8s-style "Ready: True" condition.
 */
export function buildReadyCondition(
  overrides: Partial<{
    lastTransitionTime: string;
    reason: string;
    message: string;
  }> = {},
) {
  return {
    type: 'Ready',
    status: 'True',
    lastTransitionTime: overrides.lastTransitionTime ?? '2025-01-06T10:00:05Z',
    reason: overrides.reason ?? 'Reconciled',
    message: overrides.message ?? 'Resource is ready',
  };
}

/**
 * Builds a K8s-style "Ready: False" condition.
 */
export function buildNotReadyCondition(
  overrides: Partial<{
    lastTransitionTime: string;
    reason: string;
    message: string;
  }> = {},
) {
  return {
    type: 'Ready',
    status: 'False',
    lastTransitionTime: overrides.lastTransitionTime ?? '2025-01-06T10:00:05Z',
    reason: overrides.reason ?? 'ReconciliationFailed',
    message: overrides.message ?? 'Resource is not ready',
  };
}
