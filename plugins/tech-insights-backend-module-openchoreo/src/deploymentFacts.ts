/** The subset of a Workload spec read here. */
export interface WorkloadSpec {
  container?: {
    image?: string;
    env?: { key: string; value?: string; valueFrom?: unknown }[];
  };
  endpoints?: Record<string, { visibility?: string[] }>;
}

/** The subset of a ReleaseBinding read here. */
export interface ReleaseBinding {
  spec?: {
    environment: string;
    releaseName?: string;
    state?: string;
  };
  status?: {
    conditions?: { type: string; status: string }[];
  };
}

const SECRET_LIKE_KEY =
  /(SECRET|PASSWORD|PASSWD|TOKEN|API_?KEY|PRIVATE_?KEY|CREDENTIAL)/i;

/**
 * Splits an OCI image reference. A reference without a registry host is on
 * Docker Hub, and one without a tag or digest resolves to `latest`.
 */
export function parseImage(image: string): {
  registry: string;
  pinned: boolean;
} {
  const [first, ...rest] = image.split('/');
  const hasRegistry =
    rest.length > 0 &&
    (first.includes('.') || first.includes(':') || first === 'localhost');
  const registry = hasRegistry ? first : 'docker.io';

  if (image.includes('@')) {
    return { registry, pinned: true };
  }
  const lastSegment = image.split('/').pop() ?? '';
  const tag = lastSegment.includes(':')
    ? lastSegment.slice(lastSegment.lastIndexOf(':') + 1)
    : undefined;
  return { registry, pinned: Boolean(tag) && tag !== 'latest' };
}

/** Facts read from a component's Workload. */
export function workloadFacts(workload: WorkloadSpec) {
  const image = workload.container?.image ?? '';
  const { registry, pinned } = parseImage(image);
  const endpoints = Object.values(workload.endpoints ?? {});
  return {
    openchoreoComponentResolved: true,
    openchoreoImageRegistry: registry,
    openchoreoImagePinned: image !== '' && pinned,
    openchoreoExternalEndpointCount: endpoints.filter(endpoint =>
      endpoint.visibility?.includes('external'),
    ).length,
    openchoreoPlainTextSecretEnvCount: (workload.container?.env ?? []).filter(
      env => env.value !== undefined && SECRET_LIKE_KEY.test(env.key),
    ).length,
  };
}

/**
 * Facts read from a component's release bindings. A component with no
 * active binding is not deployed anywhere, so it is not ready in every
 * environment and does not run its latest release.
 */
export function releaseBindingFacts(input: {
  bindings: ReleaseBinding[];
  productionEnvironments: Set<string>;
  latestRelease?: string;
}) {
  const active = input.bindings.filter(
    binding => binding.spec && (binding.spec.state ?? 'Active') === 'Active',
  );
  const environments = active.map(binding => binding.spec!.environment);
  const isReady = (binding: ReleaseBinding) =>
    binding.status?.conditions?.some(
      condition => condition.type === 'Ready' && condition.status === 'True',
    ) ?? false;

  return {
    openchoreoDeployedEnvironments: environments,
    openchoreoDeployedToProduction: environments.some(environment =>
      input.productionEnvironments.has(environment),
    ),
    openchoreoReadyInAllEnvironments:
      active.length > 0 && active.every(isReady),
    openchoreoRunsLatestRelease:
      active.length > 0 &&
      Boolean(input.latestRelease) &&
      active.every(
        binding => binding.spec!.releaseName === input.latestRelease,
      ),
  };
}
