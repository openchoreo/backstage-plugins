import { Environment } from './useEnvironmentData';

export interface ReleaseDriftInfo {
  /** True if at least one direct upstream is on a different `releaseName`. */
  isBehind: boolean;
  /**
   * Direct upstreams (envs whose `promotionTargets` include this env) that
   * are on a different `releaseName`. Empty when not behind.
   */
  aheadUpstreams: Array<{ envName: string; releaseName?: string }>;
}

export const NO_DRIFT: ReleaseDriftInfo = {
  isBehind: false,
  aheadUpstreams: [],
};

/**
 * "Drift" is release-name equality against direct upstreams. We treat any
 * env whose `promotionTargets` lists this env as an upstream; if any of
 * those upstreams is on a different `releaseName`, we mark this env as
 * behind. No drift signal when:
 *   - the env has no `releaseName` yet (never deployed)
 *   - the env has no upstreams in the displayed list (root of the
 *     pipeline)
 *   - all upstreams' releaseNames match this env's
 *
 * Mirrors `isAlreadyPromoted`'s primitive (release-name equality) but
 * inverts the relationship: that one asks "has source been promoted to
 * target"; this one asks "is target behind any source".
 */
export function computeReleaseDrift(
  env: Environment,
  allEnvironments: Environment[],
): ReleaseDriftInfo {
  if (!env.deployment.releaseName) {
    return NO_DRIFT;
  }
  const upstreams = allEnvironments.filter(other =>
    (other.promotionTargets ?? []).some(t => t.name === env.name),
  );
  if (upstreams.length === 0) {
    return NO_DRIFT;
  }
  const aheadUpstreams = upstreams
    .filter(u => !!u.deployment.releaseName)
    .filter(u => u.deployment.releaseName !== env.deployment.releaseName)
    .map(u => ({
      envName: u.name,
      releaseName: u.deployment.releaseName,
    }));
  return {
    isBehind: aheadUpstreams.length > 0,
    aheadUpstreams,
  };
}
