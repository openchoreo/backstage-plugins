import type { ResourceEnvironment } from '../../api/OpenChoreoClientApi';

export interface ResourceReleaseDriftInfo {
  /** True if at least one direct upstream is on a different `resourceRelease`. */
  isBehind: boolean;
  /**
   * Direct upstreams (envs whose `promotionTargets` include this env) that
   * are on a different `resourceRelease`. Empty when not behind.
   */
  aheadUpstreams: Array<{ envName: string; releaseName?: string }>;
}

export const NO_RESOURCE_DRIFT: ResourceReleaseDriftInfo = {
  isBehind: false,
  aheadUpstreams: [],
};

/**
 * Resource-flavoured port of the Component-side `computeReleaseDrift`.
 * Same primitive — release-name equality against direct upstreams —
 * but reads `resourceRelease` instead of `deployment.releaseName`.
 *
 * "Drift" surfaces both directions of the pipeline contract: the
 * upstream env shows a Promote button (it can push forward), and the
 * downstream env shows a Behind badge (it has not received the latest
 * promote). The first env (no upstream in the displayed list) never
 * reports drift here; spec-edit-without-promote drift is intentionally
 * not represented on this signal.
 */
export function computeResourceReleaseDrift(
  env: ResourceEnvironment,
  allEnvironments: ResourceEnvironment[],
): ResourceReleaseDriftInfo {
  if (!env.resourceRelease) {
    return NO_RESOURCE_DRIFT;
  }
  const upstreams = allEnvironments.filter(other =>
    (other.promotionTargets ?? []).some(t => t.name === env.name),
  );
  if (upstreams.length === 0) {
    return NO_RESOURCE_DRIFT;
  }
  const aheadUpstreams = upstreams
    .filter(u => !!u.resourceRelease)
    .filter(u => u.resourceRelease !== env.resourceRelease)
    .map(u => ({
      envName: u.name,
      releaseName: u.resourceRelease,
    }));
  return {
    isBehind: aheadUpstreams.length > 0,
    aheadUpstreams,
  };
}
