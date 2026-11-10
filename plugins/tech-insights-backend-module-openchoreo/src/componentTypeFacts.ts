/** The subset of a ComponentType or ClusterComponentType spec read here. */
export interface ComponentTypeSpec {
  workloadType?: string;
  allowedTraits?: { name: string }[];
  traits?: { name: string }[];
  allowedWorkflows?: { name: string }[];
  validations?: unknown[];
  resources?: {
    id?: string;
    targetPlane?: string;
    template?: unknown;
  }[];
}

type Json = Record<string, any>;

const POD_SPEC_PATHS = new Map([
  ['Pod', ['spec']],
  ['Deployment', ['spec', 'template', 'spec']],
  ['StatefulSet', ['spec', 'template', 'spec']],
  ['DaemonSet', ['spec', 'template', 'spec']],
  ['ReplicaSet', ['spec', 'template', 'spec']],
  ['Job', ['spec', 'template', 'spec']],
  ['CronJob', ['spec', 'jobTemplate', 'spec', 'template', 'spec']],
]);

/** A template value that is set but can't be read, such as an expression. */
const OPAQUE = Symbol('opaque');

function asObject(value: unknown): Json | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : undefined;
}

function asArray(value: unknown): Json[] {
  return Array.isArray(value) ? value.filter(v => asObject(v)) : [];
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

/** Whether a value is set where an object belongs but isn't one. */
function isOpaqueObject(value: unknown): boolean {
  return hasValue(value) && !asObject(value);
}

/**
 * The object at `path` below `value`, `undefined` when something on the way
 * is missing, or OPAQUE when something on the way is set but isn't an object.
 */
function follow(
  value: unknown,
  path: string[],
): Json | typeof OPAQUE | undefined {
  let current = value;
  for (const key of path) {
    if (isOpaqueObject(current)) return OPAQUE;
    current = asObject(current)?.[key];
  }
  if (isOpaqueObject(current)) return OPAQUE;
  return asObject(current);
}

/**
 * The pod spec a template renders. `undefined` when it renders none, and
 * OPAQUE when the kind or anything on the way to the pod spec is an
 * expression, so whether and what it renders can't be read.
 */
function podSpecOf(template: unknown): Json | typeof OPAQUE | undefined {
  if (isOpaqueObject(template)) return OPAQUE;
  const kind = asObject(template)?.kind;
  if (!hasValue(kind)) return undefined;
  if (typeof kind !== 'string' || kind.includes('${')) return OPAQUE;
  const path = POD_SPEC_PATHS.get(kind);
  return path ? follow(template, path) : undefined;
}

/**
 * Whether a container list is an expression, or holds one, so the
 * containers it renders can't be read from the template.
 */
function hasOpaqueContainers(podSpec: Json): boolean {
  return [podSpec.containers, podSpec.initContainers].some(list =>
    Array.isArray(list) ? list.some(entry => !asObject(entry)) : hasValue(list),
  );
}

/**
 * Facts about what a component type lets components do and how its
 * templates run them.
 *
 * Template values are often CEL expressions such as
 * `${parameters.privileged}`. A security setting counts as enforced only when
 * it is a literal value, since an expression can render to anything, while
 * any value other than a literal `false` counts as allowing privileged
 * containers. When the containers themselves can't be read, because a
 * template's kind, pod spec or container list is an expression, limits and
 * non-root count as not enforced and privileged containers as allowed. A
 * container whose securityContext is an expression counts as possibly root
 * and privileged. A component type with no pod-rendering template (a proxy,
 * for example) reports false for the enforcement facts.
 */
export function componentTypeFacts(spec: ComponentTypeSpec) {
  const rendered = (spec.resources ?? [])
    .filter(resource => (resource.targetPlane ?? 'dataplane') === 'dataplane')
    .map(resource => podSpecOf(resource.template));
  const podSpecs = rendered.filter(
    (podSpec): podSpec is Json => podSpec !== undefined && podSpec !== OPAQUE,
  );

  const containers = podSpecs.flatMap(podSpec =>
    [...asArray(podSpec.containers), ...asArray(podSpec.initContainers)].map(
      container => ({
        container,
        podSecurity: asObject(podSpec.securityContext),
      }),
    ),
  );

  const opaque =
    rendered.includes(OPAQUE) || podSpecs.some(hasOpaqueContainers);

  const runsAsNonRoot = ({
    container,
    podSecurity,
  }: (typeof containers)[number]) => {
    if (isOpaqueObject(container.securityContext)) return false;
    const security = asObject(container.securityContext);
    const nonRoot = security?.runAsNonRoot ?? podSecurity?.runAsNonRoot;
    const user = security?.runAsUser ?? podSecurity?.runAsUser;
    return nonRoot === true || (typeof user === 'number' && user > 0);
  };

  const setsLimits = ({ container }: (typeof containers)[number]) => {
    const limits = asObject(asObject(container.resources)?.limits);
    return hasValue(limits?.cpu) && hasValue(limits?.memory);
  };

  const allowsPrivileged = ({ container }: (typeof containers)[number]) => {
    if (isOpaqueObject(container.securityContext)) return true;
    const privileged = asObject(container.securityContext)?.privileged;
    return hasValue(privileged) && privileged !== false;
  };

  return {
    openchoreoComponentTypeResolved: true,
    openchoreoWorkloadType: spec.workloadType ?? '',
    openchoreoAllowedTraits: (spec.allowedTraits ?? []).map(t => t.name),
    openchoreoEmbeddedTraits: (spec.traits ?? []).map(t => t.name),
    openchoreoAllowedWorkflows: (spec.allowedWorkflows ?? []).map(w => w.name),
    openchoreoValidationRuleCount: spec.validations?.length ?? 0,
    openchoreoTemplatesSetResourceLimits:
      !opaque && containers.length > 0 && containers.every(setsLimits),
    openchoreoTemplatesRunAsNonRoot:
      !opaque && containers.length > 0 && containers.every(runsAsNonRoot),
    openchoreoTemplatesAllowPrivileged:
      opaque || containers.some(allowsPrivileged),
  };
}
