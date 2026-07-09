import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  ProjectReleaseBindingResponse,
  ReleaseBindingCondition,
} from '@openchoreo/backstage-plugin-common';
import { getName, getNamespace, getCreatedAt } from './common';
import { deriveBindingStatusDetailed } from './release-binding';

type NewProjectReleaseBinding =
  OpenChoreoComponents['schemas']['ProjectReleaseBinding'];

/**
 * Whether a project is deployed enough in an environment for a component of
 * that project to be deployable there. A component's ReleaseBinding applies
 * its manifests into the project's cell namespace, which is created by the
 * project's ProjectReleaseBinding — so the gating signal is the binding's
 * `NamespaceReady` condition, NOT the aggregate `Ready` (which also folds in
 * `ResourcesReady` and would wrongly report a project as undeployed when some
 * unrelated project resource is degraded).
 *
 * - `not-deployed` — no ProjectReleaseBinding exists for the environment.
 * - `ready` — the binding's `NamespaceReady` condition is `True` (cell
 *   namespace exists on the data plane).
 * - `pending` — a binding exists but `NamespaceReady` is not yet `True`
 *   (`False` / `Unknown` / absent). Covers the unpinned
 *   `Synced=False / ProjectReleaseNotSet` case, where the controller sets
 *   `NamespaceReady=Unknown` until the pin is seeded and the namespace lands.
 */
export type ProjectDeploymentStatus = 'ready' | 'pending' | 'not-deployed';

export function deriveProjectDeploymentStatus(
  binding: NewProjectReleaseBinding | undefined,
): ProjectDeploymentStatus {
  if (!binding) return 'not-deployed';
  const namespaceReady = (
    binding.status?.conditions as
      | Array<{ type?: string; status?: string }>
      | undefined
  )?.find(c => c.type === 'NamespaceReady');
  return namespaceReady?.status === 'True' ? 'ready' : 'pending';
}

/**
 * Transforms a K8s-style ProjectReleaseBinding into the flat
 * ProjectReleaseBindingResponse shape expected by the frontend. Reuses the
 * same Ready-condition derivation as the other bindings because the project
 * binding carries an aggregate Ready condition with identical vocabulary
 * (Synced / NamespaceReady / ResourcesReady / Ready).
 */
export function transformProjectReleaseBinding(
  binding: NewProjectReleaseBinding,
): ProjectReleaseBindingResponse {
  const derived = deriveBindingStatusDetailed(binding as any);

  return {
    name: getName(binding) ?? '',
    projectName: binding.spec?.owner?.projectName ?? '',
    namespaceName: getNamespace(binding) ?? '',
    environment: binding.spec?.environment ?? '',
    releaseName: binding.spec?.projectRelease ?? '',
    environmentConfigs: binding.spec?.environmentConfigs as
      | Record<string, unknown>
      | undefined,
    namespace: binding.status?.namespace,
    createdAt: getCreatedAt(binding) ?? '',
    status: derived?.status,
    statusReason: derived?.reason,
    statusMessage: derived?.message,
    conditions: (() => {
      const raw = binding.status?.conditions;
      if (!Array.isArray(raw)) return undefined;
      return raw.map(
        (c: any): ReleaseBindingCondition => ({
          // `type` and `status` are required on ReleaseBindingCondition;
          // default them since the source is untyped and a malformed
          // condition could otherwise leave required fields undefined.
          type: c.type ?? '',
          status: c.status ?? '',
          reason: c.reason,
          message: c.message,
          lastTransitionTime: c.lastTransitionTime,
          observedGeneration: c.observedGeneration,
        }),
      );
    })(),
  };
}
