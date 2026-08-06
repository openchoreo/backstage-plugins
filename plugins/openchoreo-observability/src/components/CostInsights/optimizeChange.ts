import type { FetchApi } from '@backstage/core-plugin-api';
import type { Change } from '@openchoreo/backstage-plugin-react';
import type {
  FieldChangeDef,
  ResourceChangeDef,
} from '../../utils/applyResourceChange';
import type { CostRowRecommendation } from './types';

/**
 * Resource limits/requests on a ReleaseBinding live under
 * `spec.componentTypeEnvironmentConfigs.resources.{requests,limits}.{cpu,memory}`
 * (the ComponentType env-config schema). These are the JSON pointers the FinOps
 * apply flow uses too - see `FinOpsApplyButton.test.tsx` fixtures.
 */
const POINTER = {
  cpuRequest: '/spec/componentTypeEnvironmentConfigs/resources/requests/cpu',
  cpuLimit: '/spec/componentTypeEnvironmentConfigs/resources/limits/cpu',
  memoryRequest:
    '/spec/componentTypeEnvironmentConfigs/resources/requests/memory',
  memoryLimit: '/spec/componentTypeEnvironmentConfigs/resources/limits/memory',
} as const;

/** One release binding as returned by `GET /api/openchoreo/release-bindings`. */
interface ReleaseBindingListItem {
  name: string;
  environment: string;
  lastSpecUpdateTime?: string;
  componentTypeEnvironmentConfigs?: {
    resources?: {
      requests?: { cpu?: string; memory?: string };
      limits?: { cpu?: string; memory?: string };
    };
  };
}

/** Normalize an environment name so lookups tolerate casing differences. */
export const normalizeEnv = (env: string): string => env.toLowerCase();

/** Live spec state for one environment's ReleaseBinding. */
export interface ReleaseBindingInfo {
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
  /** When the binding's spec was last changed (ISO). */
  lastSpecUpdateTime?: string;
}

/**
 * Fetch the live spec state (resource requests/limits + last spec-update time)
 * for every environment of a component, keyed by environment name.
 *
 * Needed because the observer's recommendation API derives its "current" usage —
 * and hence the recommendation itself from samples over the selected time
 * window. If the window predates a spec change, those samples reflect the old
 * spec, producing wrong recommendations (e.g. suggesting an *increase* with a
 * phantom saving). We use `lastSpecUpdateTime` to detect that case and the live
 * requests as the source of truth for the displayed `current` value.
 *
 * Best-effort: returns an empty map on any failure.
 */
export async function fetchBindingInfoByEnv(opts: {
  openchoreoBaseUrl: string;
  fetchApi: FetchApi;
  namespaceName: string;
  projectName: string;
  componentName: string;
}): Promise<Map<string, ReleaseBindingInfo>> {
  const {
    openchoreoBaseUrl,
    fetchApi,
    namespaceName,
    projectName,
    componentName,
  } = opts;

  const url = `${openchoreoBaseUrl}/release-bindings?componentName=${encodeURIComponent(
    componentName,
  )}&projectName=${encodeURIComponent(
    projectName,
  )}&namespaceName=${encodeURIComponent(namespaceName)}`;

  const map = new Map<string, ReleaseBindingInfo>();
  try {
    const response = await fetchApi.fetch(url);
    if (!response.ok) return map;
    const body = await response.json();
    const items: ReleaseBindingListItem[] = body?.data?.items ?? [];
    for (const item of items) {
      const resources = item.componentTypeEnvironmentConfigs?.resources;
      map.set(normalizeEnv(item.environment), {
        cpuRequest: resources?.requests?.cpu,
        cpuLimit: resources?.limits?.cpu,
        memoryRequest: resources?.requests?.memory,
        memoryLimit: resources?.limits?.memory,
        lastSpecUpdateTime: item.lastSpecUpdateTime,
      });
    }
  } catch {
    // Best-effort; keep the observer-derived values on failure.
  }
  return map;
}

/**
 * Resolve the ReleaseBinding `metadata.name` for a component in a given
 * environment by listing the component's bindings and matching the environment.
 *
 * The observability recommendation API does not carry a binding name, so we
 * look it up via the existing openchoreo backend route (no new backend needed).
 */
export async function resolveReleaseBindingName(opts: {
  openchoreoBaseUrl: string;
  fetchApi: FetchApi;
  namespaceName: string;
  projectName: string;
  componentName: string;
  environment: string;
}): Promise<string> {
  const {
    openchoreoBaseUrl,
    fetchApi,
    namespaceName,
    projectName,
    componentName,
    environment,
  } = opts;

  const url = `${openchoreoBaseUrl}/release-bindings?componentName=${encodeURIComponent(
    componentName,
  )}&projectName=${encodeURIComponent(
    projectName,
  )}&namespaceName=${encodeURIComponent(namespaceName)}`;

  const response = await fetchApi.fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to look up release bindings: ${response.statusText}`,
    );
  }

  const body = await response.json();
  const items: ReleaseBindingListItem[] = body?.data?.items ?? [];

  // Match the recommendation's environment against the binding's environment.
  // Fall back to a case-insensitive match to tolerate display-name vs
  // resource-name differences.
  const match =
    items.find(item => item.environment === environment) ??
    items.find(
      item => item.environment?.toLowerCase() === environment.toLowerCase(),
    );

  if (!match?.name) {
    throw new Error(
      `No release binding found for component '${componentName}' in environment '${environment}'`,
    );
  }
  return match.name;
}

/**
 * Build the resource change that applies a right-sizing recommendation. Only
 * the values present on the recommendation are patched (the observer may omit
 * some request/limit strings).
 */
export function buildOptimizeChange(
  releaseBinding: string,
  recommendation: CostRowRecommendation,
): ResourceChangeDef {
  const fields: FieldChangeDef[] = [];
  const add = (pointer: string, value?: string) => {
    if (typeof value === 'string' && value.length > 0) {
      fields.push({ json_pointer: pointer, value });
    }
  };
  add(POINTER.cpuRequest, recommendation.cpuRequest);
  add(POINTER.cpuLimit, recommendation.cpuLimit);
  add(POINTER.memoryRequest, recommendation.memoryRequest);
  add(POINTER.memoryLimit, recommendation.memoryLimit);

  return { release_binding: releaseBinding, fields };
}

/**
 * Build a human-readable list of the resource changes a recommendation applies,
 * as `current → recommended` diffs (or `[New]` when there is no current value),
 * for the confirmation dialog. No-op fields (unchanged or absent) are omitted.
 */
export function buildRecommendationChanges(
  recommendation: CostRowRecommendation,
): Change[] {
  const current = recommendation.current ?? {};
  const specs: Array<[string, string | undefined, string | undefined]> = [
    ['resources.requests.cpu', current.cpuRequest, recommendation.cpuRequest],
    ['resources.limits.cpu', current.cpuLimit, recommendation.cpuLimit],
    [
      'resources.requests.memory',
      current.memoryRequest,
      recommendation.memoryRequest,
    ],
    [
      'resources.limits.memory',
      current.memoryLimit,
      recommendation.memoryLimit,
    ],
  ];

  const changes: Change[] = [];
  for (const [path, oldValue, newValue] of specs) {
    if (!newValue || oldValue === newValue) continue;
    changes.push({
      path,
      type: oldValue ? 'modified' : 'new',
      oldValue,
      newValue,
    });
  }
  return changes;
}

/** Whether a recommendation carries at least one applyable resource value. */
export function hasApplyableRecommendation(
  recommendation: CostRowRecommendation | undefined,
): recommendation is CostRowRecommendation {
  if (!recommendation) return false;
  return Boolean(
    recommendation.cpuRequest ||
      recommendation.cpuLimit ||
      recommendation.memoryRequest ||
      recommendation.memoryLimit,
  );
}
