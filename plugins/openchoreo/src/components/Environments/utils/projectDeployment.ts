import type { Environment } from '../hooks/useEnvironmentData';

/**
 * Helpers for the "project must be deployed before a component can run in an
 * environment" rule. A component's ReleaseBinding applies its manifests into
 * the project's cell namespace, which is created by the project's
 * ProjectReleaseBinding — so a component deploy/promote into an environment
 * where the project is not deployed fails with a namespace-not-found error.
 *
 * The backend exposes `Environment.projectDeploymentStatus`; an absent value
 * means the check could not run and is treated as deployed (fail-open — never
 * block on missing data).
 */

/** The project has no deployment in this env — deploy/promote here is blocked. */
export function isProjectBlocking(
  env: Pick<Environment, 'projectDeploymentStatus'>,
): boolean {
  return env.projectDeploymentStatus === 'not-deployed';
}

/**
 * Builds a predicate that reports whether a promotion target env has its
 * project undeployed (so promoting into it is blocked). Resolves the target
 * against the loaded environments by display or resource name; an unknown
 * target is treated as not blocked (fail-open).
 */
export function makeIsTargetProjectBlocked(environments: Environment[]) {
  return (target: { name: string; resourceName?: string }): boolean => {
    const env = environments.find(
      e =>
        e.name === target.name ||
        (!!target.resourceName && e.resourceName === target.resourceName),
    );
    return env ? isProjectBlocking(env) : false;
  };
}

/**
 * The project's binding exists but its namespace isn't ready yet. Not blocked
 * (the controller converges) — surfaced as an informational note.
 */
export function isProjectPending(
  env: Pick<Environment, 'projectDeploymentStatus'>,
): boolean {
  return env.projectDeploymentStatus === 'pending';
}

/** Matches the controller's raw "namespace missing" apply error. */
const NAMESPACE_NOT_FOUND = /namespaces "[^"]*" not found/i;

/**
 * Whether a component binding's failure is attributable to the project not
 * being deployed in that environment. True when either:
 *  - the controller reports the first-class `ProjectNotDeployed` reason
 *    (future openchoreo-side enhancement), or
 *  - (today's heuristic) the reason is `ResourceApplyFailed` and the message is
 *    the namespace-not-found apply error, unless the project is explicitly
 *    known to be deployed (`projectDeploymentStatus === 'ready'`). The guard
 *    only excludes the `ready` case, so `not-deployed`, `pending`, and an
 *    absent/unknown status are all treated as eligible for attribution
 *    (fail-open) — an absent status still gets the plain-language explanation
 *    rather than the raw error. It only avoids mislabeling a genuine apply
 *    failure when the project is confirmed deployed.
 */
export function attributeToProjectNotDeployed(env: Environment): boolean {
  const { status, statusReason, statusMessage } = env.deployment;
  if (status !== 'Failed') return false;
  if (statusReason === 'ProjectNotDeployed') return true;
  const looksLikeMissingNamespace =
    statusReason === 'ResourceApplyFailed' &&
    !!statusMessage &&
    NAMESPACE_NOT_FOUND.test(statusMessage);
  return looksLikeMissingNamespace && env.projectDeploymentStatus !== 'ready';
}
