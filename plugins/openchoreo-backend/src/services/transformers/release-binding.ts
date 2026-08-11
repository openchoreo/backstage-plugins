import type { OpenChoreoComponents } from '@openchoreo/openchoreo-client-node';
import type {
  ReleaseBindingResponse,
  ReleaseBindingEndpoint,
  ReleaseBindingEndpointURLDetails,
  ReleaseBindingCondition,
} from '@openchoreo/backstage-plugin-common';
import { getName, getNamespace, getCreatedAt } from './common';

type NewReleaseBinding = OpenChoreoComponents['schemas']['ReleaseBinding'];

/**
 * Reasons on the Ready condition that indicate transient progress, not an error.
 * Keep aligned with ReleaseBinding controller condition reasons
 * (internal/controller/releasebinding/controller_conditions.go).
 */
const PROGRESSING_REASONS = [
  // Sync / dependency / rollout phases commonly seen right after deploy.
  'ReleaseSynced',
  'ResourceDependenciesPending',
  'ResourcesNotReady',
  'ResourcesProgressing',
  'JobRunning',
  'ConnectionsPending',
  'ResourcesUnknown',
  // ProjectReleaseBinding with an empty spec.projectRelease pin: the control
  // plane seeds it with the project's latest release once one exists, so a
  // just-created binding sits here briefly. Pending, not an error.
  'ProjectReleaseNotSet',
] as const;

/** Reasons that represent an intentional non-deployed state, not an error. */
const NON_ERROR_REASONS = ['ResourcesUndeployed'] as const;

/**
 * Reason core sets on the ResourcesReady condition when the primary workload is
 * intentionally suspended (e.g. a Deployment scaled to zero). The binding is
 * still Ready, so this is read from ResourcesReady, not the Ready condition.
 */
const SUSPENDED_REASON = 'ReadyWithSuspendedResources';

export interface DerivedBindingStatus {
  status: 'Ready' | 'NotReady' | 'Failed';
  reason?: string;
  message?: string;
}

/**
 * Derives a binding status from the Ready condition on the ReleaseBinding.
 *
 * The Ready condition is now always present (fixed in openchoreo#2697) and is
 * the single source of truth. Its reason distinguishes transient progress
 * (→ NotReady) from actual errors (→ Failed).
 */
export function deriveBindingStatus(
  binding: NewReleaseBinding,
): 'Ready' | 'NotReady' | 'Failed' | undefined {
  return deriveBindingStatusDetailed(binding)?.status;
}

/**
 * Like deriveBindingStatus but also returns the Ready condition's reason and
 * message so callers can surface actionable details.
 */
export function deriveBindingStatusDetailed(
  binding: NewReleaseBinding,
): DerivedBindingStatus | undefined {
  const conditions = (binding.status?.conditions ?? []) as Array<{
    type: string;
    status: string;
    reason?: string;
    message?: string;
    observedGeneration?: number;
  }>;

  if (conditions.length === 0) return { status: 'NotReady' };

  const generation = (binding as any).metadata?.generation as
    | number
    | undefined;

  // Collect conditions for the current generation.
  // Treat missing observedGeneration as a match so older controllers don't
  // cause conditions to be silently dropped.
  const conditionsForGeneration = generation
    ? conditions.filter(
        c =>
          c.observedGeneration === undefined ||
          c.observedGeneration === generation,
      )
    : conditions;

  // Use the Ready condition as the single source of truth
  const readyCond = conditionsForGeneration.find(c => c.type === 'Ready');
  if (!readyCond) return { status: 'NotReady' }; // Not yet reconciled

  if (readyCond.status === 'True') {
    // A Ready binding may still be intentionally scaled to zero. Core reports
    // that on the ResourcesReady condition, not on Ready, so surface its reason
    // and message here so the pipeline can distinguish a suspended workload from
    // a running one.
    const resourcesReady = conditionsForGeneration.find(
      c => c.type === 'ResourcesReady',
    );
    if (resourcesReady?.reason === SUSPENDED_REASON) {
      return {
        status: 'Ready',
        reason: resourcesReady.reason,
        message: resourcesReady.message,
      };
    }
    return {
      status: 'Ready',
      reason: readyCond.reason,
      message: readyCond.message,
    };
  }

  // Ready=False: distinguish progressing from errors
  if (
    PROGRESSING_REASONS.includes(
      readyCond.reason as (typeof PROGRESSING_REASONS)[number],
    )
  ) {
    return {
      status: 'NotReady',
      reason: readyCond.reason,
      message: readyCond.message,
    };
  }

  // Intentional undeploy — not an error
  if (
    NON_ERROR_REASONS.includes(
      readyCond.reason as (typeof NON_ERROR_REASONS)[number],
    )
  ) {
    return {
      status: 'NotReady',
      reason: readyCond.reason,
      message: readyCond.message,
    };
  }

  // Everything else is a failure
  return {
    status: 'Failed',
    reason: readyCond.reason,
    message: readyCond.message,
  };
}

/**
 * Reorders a URL map so that HTTPS entries come first.
 *
 * The frontend selects an endpoint's primary URL with `Object.values(urls)[0]`
 * — the first entry in iteration order — and is otherwise scheme-blind. When an
 * endpoint exposes both an http and an https URL we want the secure one to win,
 * so we surface https entries first here while keeping the relative order of
 * everything else stable. Object iteration order follows insertion order for the
 * string keys used here, so rebuilding the record is enough to influence the
 * frontend's choice without any frontend change.
 */
function prioritizeHttpsUrls(
  urls: Record<string, ReleaseBindingEndpointURLDetails>,
): Record<string, ReleaseBindingEndpointURLDetails> {
  const isHttps = (d: ReleaseBindingEndpointURLDetails | undefined) =>
    d?.scheme?.toLowerCase() === 'https';
  const entries = Object.entries(urls);
  const ordered = [
    ...entries.filter(([, d]) => isHttps(d)),
    ...entries.filter(([, d]) => !isHttps(d)),
  ];
  return Object.fromEntries(ordered);
}

/**
 * Returns a copy of the endpoint with its external/internal URL maps reordered
 * so https URLs take precedence over http when both are present.
 */
function prioritizeEndpointHttps(
  endpoint: ReleaseBindingEndpoint,
): ReleaseBindingEndpoint {
  return {
    ...endpoint,
    ...(endpoint.externalURLs
      ? { externalURLs: prioritizeHttpsUrls(endpoint.externalURLs) }
      : {}),
    ...(endpoint.internalURLs
      ? { internalURLs: prioritizeHttpsUrls(endpoint.internalURLs) }
      : {}),
  };
}

/**
 * Transforms a K8s-style ReleaseBinding resource into the flat
 * ReleaseBindingResponse shape expected by the frontend.
 */
export function transformReleaseBinding(
  binding: NewReleaseBinding,
): ReleaseBindingResponse {
  const derived = deriveBindingStatusDetailed(binding);

  return {
    name: getName(binding) ?? '',
    componentName: binding.spec?.owner?.componentName ?? '',
    projectName: binding.spec?.owner?.projectName ?? '',
    namespaceName: getNamespace(binding) ?? '',
    environment: binding.spec?.environment ?? '',
    releaseName: binding.spec?.releaseName ?? '',
    componentTypeEnvironmentConfigs:
      binding.spec?.componentTypeEnvironmentConfigs,
    traitEnvironmentConfigs: binding.spec?.traitEnvironmentConfigs,
    workloadOverrides: binding.spec?.workloadOverrides as
      | ReleaseBindingResponse['workloadOverrides']
      | undefined,
    createdAt: getCreatedAt(binding) ?? '',
    lastSpecUpdateTime:
      (binding.status as any)?.lastSpecUpdateTime ?? undefined,
    status: derived?.status,
    statusReason: derived?.reason,
    statusMessage: derived?.message,
    endpoints: (() => {
      const raw = (binding.status as any)?.endpoints;
      if (!Array.isArray(raw)) return undefined;
      return raw
        .filter(
          (e): e is ReleaseBindingEndpoint =>
            e !== null && typeof e === 'object' && typeof e.name === 'string',
        )
        .map(prioritizeEndpointHttps);
    })(),
    conditions: (() => {
      const raw = binding.status?.conditions;
      if (!Array.isArray(raw)) return undefined;
      return raw.map(
        (c: any): ReleaseBindingCondition => ({
          type: c.type,
          status: c.status,
          reason: c.reason,
          message: c.message,
          lastTransitionTime: c.lastTransitionTime,
          observedGeneration: c.observedGeneration,
        }),
      );
    })(),
  };
}
