/** An environment variable of a Workload or a release binding override. */
export interface EnvVar {
  key: string;
  value?: string;
  valueFrom?: unknown;
}

/** The subset of a Workload spec read here. */
export interface WorkloadSpec {
  container?: {
    image?: string;
    env?: EnvVar[];
  };
  endpoints?: Record<string, { visibility?: string[] }>;
}

/** The subset of a ReleaseBinding read here. */
export interface ReleaseBinding {
  spec?: {
    environment: string;
    releaseName?: string;
    state?: string;
    workloadOverrides?: { container?: { env?: EnvVar[] } };
  };
  status?: {
    conditions?: { type: string; status: string }[];
  };
}

/** Name parts that mark a value as a secret. */
const SECRET_WORDS = new Set([
  'SECRET',
  'PASSWORD',
  'PASSWD',
  'PASS',
  'TOKEN',
  'CREDENTIAL',
  'CREDENTIALS',
  'APIKEY',
  'PRIVATEKEY',
]);

/** Pairs of name parts that mark a value as a secret together. */
const SECRET_PAIRS = new Set(['API_KEY', 'PRIVATE_KEY']);

/**
 * Last name parts that make the value a pointer to a secret rather than the
 * secret itself, such as `TOKEN_URL` or `PASSWORD_FILE`.
 */
const POINTER_SUFFIXES = new Set([
  'URL',
  'URI',
  'PATH',
  'FILE',
  'NAME',
  'HOST',
]);

/**
 * Whether an env var name looks like it holds a secret, matched on the parts
 * between underscores so `DB_PASS` matches and `PASSPORT_ID` doesn't.
 */
export function isSecretLikeKey(key: string): boolean {
  const parts = key
    .toUpperCase()
    .split(/[_\-.]+/)
    .filter(Boolean);
  if (parts.length === 0 || POINTER_SUFFIXES.has(parts[parts.length - 1])) {
    return false;
  }
  return parts.some(
    (part, index) =>
      SECRET_WORDS.has(part) ||
      // A bare PWD is the shell's working directory, so it counts only as
      // part of a longer name such as DB_PWD.
      (part === 'PWD' && parts.length > 1) ||
      (index > 0 && SECRET_PAIRS.has(`${parts[index - 1]}_${part}`)),
  );
}

/**
 * Secret-like names holding a plain value across `envLists`, each counted
 * once however many lists set it.
 */
export function plainTextSecretEnvCount(envLists: EnvVar[][]): number {
  const keys = new Set<string>();
  for (const env of envLists.flat()) {
    if (env.value !== undefined && isSecretLikeKey(env.key)) {
      keys.add(env.key);
    }
  }
  return keys.size;
}

/** Tags that conventionally move to newer builds. */
const MOVING_TAGS = new Set([
  'latest',
  'main',
  'master',
  'dev',
  'develop',
  'edge',
  'nightly',
  'stable',
  'staging',
]);

/**
 * Splits an OCI image reference. A reference without a registry host is on
 * Docker Hub, and one without a tag or digest resolves to `latest`. A digest
 * pins the image; a tag does unless it's one that conventionally moves.
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
  return {
    registry,
    pinned: Boolean(tag) && !MOVING_TAGS.has(tag!.toLowerCase()),
  };
}

/** Facts read from a component's Workload. */
export function workloadFacts(workload: WorkloadSpec) {
  const image = workload.container?.image ?? '';
  const { registry, pinned } = parseImage(image);
  const endpoints = Object.values(workload.endpoints ?? {});
  return {
    openchoreoImageRegistry: registry,
    openchoreoImagePinned: image !== '' && pinned,
    openchoreoExternalEndpointCount: endpoints.filter(endpoint =>
      endpoint.visibility?.includes('external'),
    ).length,
    openchoreoPlainTextSecretEnvCount: plainTextSecretEnvCount([
      workload.container?.env ?? [],
    ]),
  };
}

/** Release bindings that deploy, rather than undeploy, their release. */
export function activeBindings(bindings: ReleaseBinding[]): ReleaseBinding[] {
  return bindings.filter(
    binding => binding.spec && (binding.spec.state ?? 'Active') === 'Active',
  );
}

/**
 * Facts read from a component's release bindings. A component with no
 * active binding is not deployed anywhere, so it is not ready in every
 * environment and does not run its latest release. Whether it runs its
 * latest release is left out when OpenChoreo hasn't recorded one, which it
 * does only for components that deploy automatically.
 */
export function releaseBindingFacts(input: {
  bindings: ReleaseBinding[];
  productionEnvironments: Set<string>;
  latestRelease?: string;
}) {
  const active = activeBindings(input.bindings);
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
    ...(input.latestRelease && {
      openchoreoRunsLatestRelease:
        active.length > 0 &&
        active.every(
          binding => binding.spec!.releaseName === input.latestRelease,
        ),
    }),
  };
}
