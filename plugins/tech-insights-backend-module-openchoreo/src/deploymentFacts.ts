import {
  endpointManagingComponent,
  endpointManagingReleaseLine,
  type EndpointOwner,
} from '@openchoreo/backstage-plugin-common';

/** An environment variable of a Workload or a release binding override. */
export interface EnvVar {
  key: string;
  value?: string;
  valueFrom?: unknown;
}

/**
 * The subset of the Workload a ComponentRelease freezes (`spec.workload`)
 * read here.
 */
export interface ReleasedWorkload {
  container?: {
    image?: string;
    env?: EnvVar[];
  };
}

/** The subset of a ReleaseBinding read here. */
export interface ReleaseBinding {
  spec?: {
    owner?: { releaseLine?: string };
    environment: string;
    releaseName?: string;
    state?: string;
    /**
     * `Manage` or `Observe`. The API client's types don't declare it, so it's
     * read as whatever the response carries.
     */
    mode?: string;
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

/**
 * The bindings of `releaseLine`, or of the main line when it's undefined.
 * OpenChoreo leaves a main-line binding's `owner.releaseLine` unset.
 */
export function lineBindings(
  bindings: ReleaseBinding[],
  releaseLine?: string,
): ReleaseBinding[] {
  return bindings.filter(
    binding => (binding.spec?.owner?.releaseLine || undefined) === releaseLine,
  );
}

/** Release bindings that deploy, rather than undeploy, their release. */
export function activeBindings(bindings: ReleaseBinding[]): ReleaseBinding[] {
  return bindings.filter(
    binding => binding.spec && (binding.spec.state ?? 'Active') === 'Active',
  );
}

function hasCondition(binding: ReleaseBinding, type: string): boolean {
  return (
    binding.status?.conditions?.some(
      condition => condition.type === type && condition.status === 'True',
    ) ?? false
  );
}

/** Whether a binding reads objects its component already runs. */
export function isObserveBinding(binding: ReleaseBinding): boolean {
  return binding.spec?.mode === 'Observe';
}

/**
 * Whether `releases` holds the ComponentRelease of every binding that renders
 * one, with at least one such binding. A binding that names no release, or
 * whose release couldn't be read, makes it false.
 */
export function everyReleaseRead(
  bindings: ReleaseBinding[],
  releases: Map<string, ReleasedWorkload | undefined>,
): boolean {
  const rendering = bindings.filter(binding => !isObserveBinding(binding));
  return (
    rendering.length > 0 &&
    rendering.every(binding => {
      const releaseName = binding.spec?.releaseName;
      return Boolean(releaseName) && releases.get(releaseName!) !== undefined;
    })
  );
}

/**
 * One entry of `openchoreoEnvironmentDeployments`. A type alias rather than
 * an interface, so it's assignable to the JSON values a fact holds.
 */
export type EnvironmentDeployment = {
  environment: string;
  isProduction: boolean;
  isReleaseSynced: boolean;
  isReady: boolean;
  isOnLatestRelease?: boolean;
  plainTextSecretEnvVarCount?: number;
  isImagePinned?: boolean;
  imageRegistry?: string;
  externalEndpointCount?: number;
};

/**
 * The entry for one active release binding. A field whose source is unknown
 * is left out rather than guessed:
 *
 * - `isOnLatestRelease` when OpenChoreo records no latest release, which it
 *   does only for lines that deploy automatically
 * - the image and secret fields when the binding's ComponentRelease
 *   (`release`) couldn't be read, and `imageRegistry` also when the release
 *   names no image
 * - `externalEndpointCount` when the line's Endpoints (`externalEndpoints`)
 *   couldn't be read
 *
 * An Observe binding renders nothing from its release, so the fields that
 * describe the release are left out for it too.
 */
export function environmentDeployment(input: {
  binding: ReleaseBinding;
  productionEnvironments: Set<string>;
  latestRelease?: string;
  release?: ReleasedWorkload;
  externalEndpoints?: Map<string, number>;
}): EnvironmentDeployment {
  const { binding, release, externalEndpoints } = input;
  const spec = binding.spec!;
  const rendersRelease = !isObserveBinding(binding);
  const image = release?.container?.image ?? '';
  const { registry, pinned } = parseImage(image);
  return {
    environment: spec.environment,
    isProduction: input.productionEnvironments.has(spec.environment),
    // A binding whose release is missing, can't be rendered or has nowhere
    // to go never syncs.
    isReleaseSynced: hasCondition(binding, 'ReleaseSynced'),
    isReady: hasCondition(binding, 'Ready'),
    ...(rendersRelease &&
      input.latestRelease && {
        isOnLatestRelease: spec.releaseName === input.latestRelease,
      }),
    ...(rendersRelease &&
      release && {
        // Overrides set for the environment are what it runs, so they
        // count along with the released Workload's own values.
        plainTextSecretEnvVarCount: plainTextSecretEnvCount([
          release.container?.env ?? [],
          spec.workloadOverrides?.container?.env ?? [],
        ]),
        isImagePinned: image !== '' && pinned,
        ...(image !== '' && { imageRegistry: registry }),
      }),
    ...(externalEndpoints && {
      externalEndpointCount: externalEndpoints.get(spec.environment) ?? 0,
    }),
  };
}

/** The subset of an Endpoint read here. */
export interface Endpoint {
  metadata: { name: string };
  spec?: { owner?: EndpointOwner; visibility?: string[] };
}

/** The subset of an EndpointReleaseBinding read here. */
export interface EndpointReleaseBinding {
  spec?: {
    owner?: { projectName?: string; endpointName?: string };
    environment?: string;
  };
}

/**
 * The external Endpoints a line owns: the main line's when `releaseLine` is
 * undefined. An Endpoint whose backends reach beyond the line belongs to its
 * component or project instead, so it isn't counted for the line.
 */
export function lineExternalEndpoints(
  endpoints: Endpoint[],
  componentName: string,
  releaseLine?: string,
): Endpoint[] {
  return endpoints.filter(
    endpoint =>
      endpointManagingComponent(endpoint.spec?.owner) === componentName &&
      endpointManagingReleaseLine(endpoint.spec?.owner) ===
        (releaseLine ?? '') &&
      (endpoint.spec?.visibility ?? []).includes('external'),
  );
}

/**
 * How many of the Endpoints named `endpointNames` have a binding in each
 * environment, among the bindings of a namespace. Only bindings in
 * `projectName` count, and an Endpoint counts once per environment.
 */
export function endpointsPerEnvironment(
  projectName: string,
  endpointNames: string[],
  bindings: EndpointReleaseBinding[],
): Map<string, number> {
  const names = new Set(endpointNames);
  const environmentsByEndpoint = new Map<string, Set<string>>();
  for (const binding of bindings) {
    const owner = binding.spec?.owner;
    const environment = binding.spec?.environment;
    if (
      owner?.projectName !== projectName ||
      !owner.endpointName ||
      !names.has(owner.endpointName) ||
      !environment
    ) {
      continue;
    }
    const environments =
      environmentsByEndpoint.get(owner.endpointName) ?? new Set<string>();
    environments.add(environment);
    environmentsByEndpoint.set(owner.endpointName, environments);
  }
  const counts = new Map<string, number>();
  for (const environments of environmentsByEndpoint.values()) {
    for (const environment of environments) {
      counts.set(environment, (counts.get(environment) ?? 0) + 1);
    }
  }
  return counts;
}
